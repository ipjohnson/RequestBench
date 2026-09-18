// What the table shows. Every function here is pure, which is what makes it checkable at all:
// the renderer this replaces could only be checked by opening the page and clicking.
import { describe, expect, test } from "vitest";
import {
  choicesAt,
  famsAt,
  filterFor,
  isSerial,
  pickRung,
  rateLabel,
  rows,
  wireFor,
  wireKeyFor,
} from "../src/client/select.js";
import { initialState } from "../src/client/state.js";
import type { Route, Run, Target, WireDoc } from "../src/lib/types.js";

const routes: Record<string, Route> = {
  "json.small": { m: "GET", p: "/json/small" },
  "json.medium": { m: "GET", p: "/json/medium", b: "json.small", v: "payload.size" },
};

const chi: Target = {
  language: "go",
  target: "chi",
  framework: "chi",
  version: "v5.3.2",
  rungs: {
    "1": { offered_rps: 1000, achieved_rps: 1000, completed: true, p50_us: 185 },
    "2": { offered_rps: 5000, achieved_rps: 4100, completed: false, saturated: true, p50_us: 900 },
  },
  families_by_rung: {
    "1": { json: { count: 20, p50_us: 190 } },
    "2": { json: { count: 40, p50_us: 950 } },
  },
  endpoints: {
    "json.small": { family: "json", rungs: { "1": { p50_us: 180, count: 10 } } },
    "json.medium": { family: "json", rungs: { "1": { p50_us: 200, count: 10 } } },
  },
};

const fastify: Target = {
  language: "node",
  target: "fastify",
  rungs: { "1": { offered_rps: 1000, achieved_rps: 1000, completed: true, p50_us: 240 } },
};

const run: Run = {
  run_id: "2026-09-16T02:14Z.container.763d6e",
  date: "2026-09-16",
  suite: "blend-v2",
  tracked: true,
  exec_host: "container",
  rungs: [1, 2],
  endpoint_order: ["json.small", "json.medium"],
  targets: [chi, fastify],
};

const st = () => initialState("container", ["go", "node"]);

describe("pickRung", () => {
  test("prefers the highest rate nobody saturated", () => {
    expect(pickRung(run, null)).toBe("1");
  });

  test("honours an explicit choice this run has", () => {
    expect(pickRung(run, "2")).toBe("2");
  });

  test("ignores a choice this run does not have", () => {
    expect(pickRung(run, "9")).toBe("1");
  });
});

describe("rateLabel", () => {
  test("a rate ladder names the rate", () => {
    expect(rateLabel(run, "2")).toBe("5,000 rps");
  });

  test("a serial suite has no rate to name", () => {
    const serial = { ...run, suite: "sequence-v2" } satisfies Run;
    expect(isSerial(serial)).toBe(false);
    expect(isSerial({ ...run, suite: "serial-v1" })).toBe(true);
    expect(rateLabel({ ...run, suite: "serial-v1" }, "1")).toBe("serial, one at a time");
  });
});

describe("famsAt", () => {
  test("reads the rung-keyed map when there is one", () => {
    expect(famsAt(chi, "2")["json"]?.p50_us).toBe(950);
  });

  test("falls back to the middle rung's copy only when there is no keyed map", () => {
    const old: Target = { ...chi, families: { json: { p50_us: 111 } } };
    delete (old as { families_by_rung?: unknown }).families_by_rung;
    expect(famsAt(old, "2")["json"]?.p50_us).toBe(111);
  });
});

describe("rows", () => {
  test("blend gives one row per target, ranked by the metric", () => {
    const { rows: rs } = rows({ run, st: st(), routes, wireOf: () => undefined });
    expect(rs.map((r) => r.label)).toEqual(["chi", "fastify"]);
    expect(rs[0]?.value).toBe(185);
  });

  test("a language chip that is off takes its rows with it", () => {
    const s = st();
    s.langs = new Set(["node"]);
    const { rows: rs } = rows({ run, st: s, routes, wireOf: () => undefined });
    expect(rs.map((r) => r.label)).toEqual(["fastify"]);
  });

  test("endpoint granularity carries the delta against the base", () => {
    const s = st();
    s.gran = "endpoint";
    const { rows: rs } = rows({ run, st: s, routes, wireOf: () => undefined });
    const medium = rs.find((r) => r.detail === "json.medium");
    expect(medium?.delta?.total).toBe(20);
    expect(rs.find((r) => r.detail === "json.small")?.delta).toBeNull();
  });

  test("the filter matches an endpoint id, a target or a family", () => {
    const s = st();
    s.gran = "endpoint";
    s.q = "medium";
    const { rows: rs } = rows({ run, st: s, routes, wireOf: () => undefined });
    expect(rs.map((r) => r.detail)).toEqual(["json.medium"]);
  });

  test("a target that did not complete the rate is marked dead", () => {
    const s = st();
    s.rung = "2";
    const { rows: rs } = rows({ run, st: s, routes, wireOf: () => undefined });
    expect(rs.find((r) => r.label === "chi")?.dead).toBe(true);
  });
});

describe("the filter at family and endpoint granularity", () => {
  const two: Run = {
    ...run,
    endpoint_order: ["baseline.plaintext", "json.small", "json.medium"],
    targets: [
      {
        ...chi,
        endpoints: {
          "baseline.plaintext": { family: "baseline", rungs: { "1": { p50_us: 150, count: 10 } } },
          ...chi.endpoints,
        },
      },
      fastify,
    ],
  };

  test("offers the run's families or its endpoint ids, in run order", () => {
    expect(choicesAt(two, "family", "1")).toEqual(["baseline", "json"]);
    expect(choicesAt(two, "endpoint", "1")).toEqual(["baseline.plaintext", "json.small", "json.medium"]);
    expect(choicesAt(two, "blend", "1")).toEqual([]);
  });

  test("a run with no endpoint order offers the families its targets carry at the rate", () => {
    const old: Run = { ...run, endpoint_order: [] };
    expect(choicesAt(old, "family", "1")).toEqual(["json"]);
    expect(choicesAt(old, "endpoint", "1")).toEqual([]);
  });

  test("opens on the run's first family or endpoint when the filter names nothing", () => {
    expect(filterFor(two, "family", "1", "")).toBe("baseline");
    expect(filterFor(two, "endpoint", "1", "")).toBe("baseline.plaintext");
    expect(filterFor(two, "endpoint", "1", "no-such-thing")).toBe("baseline.plaintext");
  });

  test("carries an endpoint to its family and a family to its first endpoint", () => {
    expect(filterFor(two, "family", "1", "json.medium")).toBe("json");
    expect(filterFor(two, "endpoint", "1", "json")).toBe("json.small");
  });

  test("keeps a filter that still matches, which is how a framework stays filtered", () => {
    expect(filterFor(two, "endpoint", "1", "chi")).toBe("chi");
    expect(filterFor(two, "family", "1", "chi")).toBe("chi");
    expect(filterFor(two, "endpoint", "1", "medium")).toBe("medium");
  });

  test("leaves the blend's filter alone", () => {
    expect(filterFor(two, "blend", "1", "")).toBe("");
  });

  test("a name from the list selects that endpoint alone", () => {
    const s = st();
    s.gran = "endpoint";
    s.q = filterFor(two, "endpoint", "1", "json");
    const { rows: rs } = rows({ run: two, st: s, routes, wireOf: () => undefined });
    expect(rs.map((r) => r.detail)).toEqual(["json.small"]);
  });
});

describe("wire captures", () => {
  const index = { "go-chi@container": {}, "node-fastify": {} };

  test("a capture on this host wins", () => {
    expect(wireKeyFor("go", "chi", "container", index)).toBe("go-chi@container");
  });

  test("a capture with no host is the fallback", () => {
    expect(wireKeyFor("node", "fastify", "container", index)).toBe("node-fastify");
  });

  test("no capture is null rather than another target's", () => {
    expect(wireKeyFor("rust", "axum", "container", index)).toBeNull();
  });

  const doc: WireDoc = {
    framework: "chi",
    version: "v5.3.2",
    adapter: "",
    serializer: "",
    endpoints: {
      "json.small": { family: "json", m: "GET", p: "/json/small", rh: [], rb: "", rbz: 0, s: 200, sh: [], shz: 100, sbz: 40, fr: "content-length", sb: "{}", tr: false },
      "json.medium": { family: "json", m: "GET", p: "/json/medium", rh: [], rb: "", rbz: 0, s: 200, sh: [], shz: 110, sbz: 400, fr: "chunked", sb: "{}", tr: false },
    },
  };

  test("a blend sums the bytes and says mixed when the framing is not one thing", () => {
    expect(wireFor(doc, "blend", "")).toEqual({ hdrz: 210, bodyz: 440, framing: "mixed" });
  });

  test("an endpoint carries its own exchange", () => {
    expect(wireFor(doc, "endpoint", "json.small").ex?.p).toBe("/json/small");
  });
});
