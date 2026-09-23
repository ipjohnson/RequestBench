// What the table shows. Every function here is pure, which is what makes it checkable at all.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { BUCKETS, bucketOf, pct } from "../../traffic-generator/histogram.ts";
import { choicesAt, filterFor, pickRung, rateLabel, rows, wireFor, wireKeyFor } from "../src/client/select.ts";
import { initialState } from "../src/client/state.ts";
import type { Framework, Route, Run, WireDoc } from "../src/lib/types.ts";

const routes: Record<string, Route> = {
  "json.small": { m: "GET", p: "/json/small" },
  "json.medium": { m: "GET", p: "/json/medium", b: "json.small", v: "size" },
};

const carter: Framework = {
  id: "dotnet:carter",
  language: "dotnet",
  name: "carter",
  framework: "Carter",
  version: "10.0.0",
  meta: { adapter: "", serializer: "System.Text.Json" },
  rungs: {
    regular: { rps: 500, achievedRps: 500, completed: true, p50Us: 185 },
    raised: { rps: 2500, achievedRps: 2292, completed: false, saturated: true, p50Us: null },
  },
  families: {
    regular: { json: { count: 20, p50Us: 190 } },
  },
  tests: {
    "json.small": { family: "json", rungs: { regular: { p50Us: 180, count: 10 } } },
    "json.medium": { family: "json", rungs: { regular: { p50Us: 200, count: 10 } } },
  },
};

const fastify: Framework = {
  id: "node:fastify",
  language: "node",
  name: "fastify",
  rungs: { regular: { rps: 500, achievedRps: 500, completed: true, p50Us: 240 } },
  families: {},
  tests: {},
};

const run: Run = {
  runId: "2026-09-21T2331Z.container-h1.5d0c44",
  date: "2026-09-21",
  ladder: "ladder-v1",
  recorded: true,
  host: "container-h1",
  frameworks: [carter, fastify],
};

const st = () => initialState("container-h1", ["dotnet", "node"]);

describe("pickRung", () => {
  /** One framework on a three-rate ladder, saturated at the rates marked. */
  const ladder = (saturated: boolean[]): Run => ({
    ...run,
    frameworks: [
      {
        id: "python:fastapi",
        language: "python",
        name: "fastapi",
        families: {},
        tests: {},
        rungs: Object.fromEntries(
          saturated.map((s, i) => [["regular", "raised", "peak"][i]!, { rps: [500, 2500, 5000][i]!, saturated: s, completed: !s }]),
        ),
      },
    ],
  });

  test("opens on the first rate", () => {
    assert.equal(pickRung(run, null), "regular");
  });

  test("opens on the first rate when a slow framework saturated every rate", () => {
    assert.equal(pickRung(ladder([true, true, true]), null), "regular");
  });

  test("opens on the first rate when a higher one has nobody saturated", () => {
    assert.equal(pickRung(ladder([false, false, false]), null), "regular");
  });

  test("honours an explicit choice this run has", () => {
    assert.equal(pickRung(run, "raised"), "raised");
  });

  test("ignores a choice this run does not have", () => {
    assert.equal(pickRung(run, "beyond"), "regular");
  });
});

describe("rateLabel", () => {
  test("names the offered rate", () => {
    assert.equal(rateLabel(run, "raised"), "2,500 rps");
  });

  test("a rung no framework has is named by its name", () => {
    assert.equal(rateLabel(run, "beyond"), "beyond");
  });
});

describe("rows", () => {
  test("blend gives one row per framework, ranked by the metric", () => {
    const { rows: rs } = rows({ run, st: st(), routes, wireOf: () => undefined });
    assert.deepEqual(
      rs.map((r) => r.label),
      ["carter", "fastify"],
    );
    assert.equal(rs[0]?.value, 185);
    assert.equal(rs[0]?.serializer, "System.Text.Json");
  });

  test("a language chip that is off takes its rows with it", () => {
    const s = st();
    s.langs = new Set(["node"]);
    const { rows: rs } = rows({ run, st: s, routes, wireOf: () => undefined });
    assert.deepEqual(
      rs.map((r) => r.label),
      ["fastify"],
    );
  });

  test("test granularity carries the delta against the base", () => {
    const s = st();
    s.gran = "test";
    const { rows: rs } = rows({ run, st: s, routes, wireOf: () => undefined });
    const medium = rs.find((r) => r.detail === "json.medium");
    assert.equal(medium?.delta?.total, 20);
    assert.equal(rs.find((r) => r.detail === "json.small")?.delta, null);
  });

  test("the filter matches a test id, a framework or a family", () => {
    const s = st();
    s.gran = "test";
    s.q = "medium";
    const { rows: rs } = rows({ run, st: s, routes, wireOf: () => undefined });
    assert.deepEqual(
      rs.map((r) => r.detail),
      ["json.medium"],
    );
  });

  test("a framework that did not complete the rate is marked dead, with no latency", () => {
    const s = st();
    s.rung = "raised";
    const { rows: rs } = rows({ run, st: s, routes, wireOf: () => undefined });
    const row = rs.find((r) => r.label === "carter");
    assert.equal(row?.dead, true);
    assert.equal(row?.value, null);
    assert.equal(row?.n, 2292);
  });

  test("a rate a framework did not complete has no families", () => {
    const s = st();
    s.gran = "family";
    s.rung = "raised";
    assert.deepEqual(rows({ run, st: s, routes, wireOf: () => undefined }).rows, []);
  });
});

describe("a blend other than All", () => {
  /** One test's histogram, `n` answers at one latency. */
  const one = (us: number, n: number) => ({ count: n, hist: { first: bucketOf(us), counts: [n] } });
  const at = (us: number, n: number): number[] => {
    const h = new Array<number>(BUCKETS).fill(0);
    h[bucketOf(us)] = n;
    return h;
  };
  const withHist: Run = {
    ...run,
    frameworks: [
      {
        ...carter,
        tests: {
          "json.small": { family: "json", rungs: { regular: one(150, 10) } },
          "template.small": { family: "template", rungs: { regular: one(900, 10) } },
        },
      },
      fastify,
    ],
  };

  test("is read off the histograms of the tests it names", () => {
    const s = st();
    s.q = "Web";
    const carterRow = rows({ run: withHist, st: s, routes, wireOf: () => undefined }).rows.find((r) => r.label === "carter");
    assert.equal(carterRow?.value, pct(at(900, 10), 50));
    s.q = "api";
    assert.equal(rows({ run: withHist, st: s, routes, wireOf: () => undefined }).rows.find((r) => r.label === "carter")?.value, pct(at(150, 10), 50));
  });

  test("keeps the whole mix's achieved rate, which no blend changes", () => {
    const s = st();
    s.q = "Web";
    s.metric = "achievedRps";
    assert.equal(rows({ run: withHist, st: s, routes, wireOf: () => undefined }).rows.find((r) => r.label === "carter")?.value, 500);
  });

  test("has no latency where the framework has no histograms", () => {
    const s = st();
    s.q = "API";
    const fastifyRow = rows({ run: withHist, st: s, routes, wireOf: () => undefined }).rows.find((r) => r.label === "fastify");
    assert.equal(fastifyRow?.value, null);
    assert.equal(fastifyRow?.dead, false);
  });

  test("has no latency at a rate the framework did not complete", () => {
    const s = st();
    s.q = "Custom";
    s.pick = { entries: ["json"], weights: {} };
    s.rung = "raised";
    const carterRow = rows({ run: withHist, st: s, routes, wireOf: () => undefined }).rows.find((r) => r.label === "carter");
    assert.deepEqual([carterRow?.value, carterRow?.dead], [null, true]);
  });

  test("is chosen only at blend granularity", () => {
    const s = st();
    s.gran = "family";
    s.q = "Web";
    assert.deepEqual(rows({ run: withHist, st: s, routes, wireOf: () => undefined }).rows, []);
  });
});

describe("the filter at blend granularity", () => {
  test("a filter that names no blend is a framework's name, read over All", () => {
    const s = st();
    s.q = "cart";
    const { rows: rs } = rows({ run, st: s, routes, wireOf: () => undefined });
    assert.deepEqual(
      rs.map((r) => [r.label, r.value]),
      [["carter", 185]],
    );
  });
});

describe("the filter at family and test granularity", () => {
  const two: Run = {
    ...run,
    frameworks: [
      {
        ...carter,
        tests: {
          "baseline.plaintext": { family: "baseline", rungs: { regular: { p50Us: 150, count: 10 } } },
          ...carter.tests,
        },
      },
      fastify,
    ],
  };

  test("offers the run's families or its test ids, in id order", () => {
    assert.deepEqual(choicesAt(two, "family", "regular"), ["baseline", "json"]);
    assert.deepEqual(choicesAt(two, "test", "regular"), ["baseline.plaintext", "json.medium", "json.small"]);
    assert.deepEqual(choicesAt(two, "blend", "regular"), ["All", "Web", "API", "Custom"]);
  });

  test("opens on the run's first family or test when the filter names nothing", () => {
    assert.equal(filterFor(two, "family", "regular", ""), "baseline");
    assert.equal(filterFor(two, "test", "regular", ""), "baseline.plaintext");
    assert.equal(filterFor(two, "test", "regular", "no-such-thing"), "baseline.plaintext");
  });

  test("carries a test to its family and a family to its first test", () => {
    assert.equal(filterFor(two, "family", "regular", "json.medium"), "json");
    assert.equal(filterFor(two, "test", "regular", "json"), "json.medium");
  });

  test("keeps a filter that still matches, which is how a framework stays filtered", () => {
    assert.equal(filterFor(two, "test", "regular", "carter"), "carter");
    assert.equal(filterFor(two, "family", "regular", "carter"), "carter");
    assert.equal(filterFor(two, "test", "regular", "medium"), "medium");
  });

  test("opens the blend view on All, keeping a blend or a framework the filter names", () => {
    assert.equal(filterFor(two, "blend", "regular", ""), "All");
    assert.equal(filterFor(two, "blend", "regular", "json"), "All");
    assert.equal(filterFor(two, "blend", "regular", "Web"), "Web");
    assert.equal(filterFor(two, "blend", "regular", "carter"), "carter");
  });

  test("a blend's name opens a family or test view on its first name", () => {
    assert.equal(filterFor(two, "family", "regular", "All"), "baseline");
    assert.equal(filterFor(two, "test", "regular", "All"), "baseline.plaintext");
  });

  test("a name from the list selects that test alone", () => {
    const s = st();
    s.gran = "test";
    s.q = filterFor(two, "test", "regular", "json.small");
    const { rows: rs } = rows({ run: two, st: s, routes, wireOf: () => undefined });
    assert.deepEqual(
      rs.map((r) => r.detail),
      ["json.small"],
    );
  });
});

describe("wire captures", () => {
  const index = { "dotnet-carter@container-h1": {}, "node-fastify@container-h2": {} };

  test("a capture on this host is the one read", () => {
    assert.equal(wireKeyFor("dotnet", "carter", "container-h1", index), "dotnet-carter@container-h1");
  });

  test("a capture from another host is not this one's", () => {
    assert.equal(wireKeyFor("node", "fastify", "container-h1", index), null);
  });

  const doc: WireDoc = {
    framework: "dotnet:carter",
    host: "container-h1",
    tests: {
      "json.small": { family: "json", m: "GET", p: "/json/small", rh: [], rb: "", rbz: 0, s: 200, sh: [], shz: 100, sbz: 40, fr: "content-length", sb: "{}", tr: false },
      "json.medium": { family: "json", m: "GET", p: "/json/medium", rh: [], rb: "", rbz: 0, s: 200, sh: [], shz: 110, sbz: 400, fr: "chunked", sb: "{}", tr: false },
    },
  };

  test("a blend sums the bytes and says mixed when the framing is not one thing", () => {
    assert.deepEqual(wireFor(doc, "blend", ""), { hdrz: 210, bodyz: 440, framing: "mixed" });
  });

  test("a blend other than All sums only its own tests", () => {
    assert.deepEqual(wireFor(doc, "blend", "", new Set(["json.medium"])), { hdrz: 110, bodyz: 400, framing: "chunked" });
  });

  test("a test carries its own exchange", () => {
    assert.equal(wireFor(doc, "test", "json.small").ex?.p, "/json/small");
  });
});
