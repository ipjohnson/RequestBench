// The lists a summary does not write down: its rungs, its tests and its languages.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { familyOf, machineOf, machinesFor, metaOf, rungsOf, testOrder, timeline } from "../src/lib/run.ts";
import type { Framework, Run } from "../src/lib/types.ts";

const framework = (id: string, rungs: string[], tests: string[]): Framework => {
  const [language = "", name = ""] = id.split(":");
  return {
    id,
    language,
    name,
    families: {},
    rungs: Object.fromEntries(rungs.map((rn) => [rn, { rps: 1 }])),
    tests: Object.fromEntries(tests.map((t) => [t, { family: t.split(".")[0]!, rungs: {} }])),
  };
};

describe("rungsOf", () => {
  test("keeps the ladder's order, which is the order a summary writes them in", () => {
    const run: Run = { runId: "r", frameworks: [framework("dotnet:carter", ["regular", "raised", "peak"], [])] };
    assert.deepEqual(rungsOf(run), ["regular", "raised", "peak"]);
  });

  test("a framework that failed before it was measured names none, and the others still do", () => {
    const run: Run = {
      runId: "r",
      frameworks: [framework("node:fastify", [], []), framework("dotnet:carter", ["regular", "raised"], [])],
    };
    assert.deepEqual(rungsOf(run), ["regular", "raised"]);
  });

  test("no run has no rungs", () => {
    assert.deepEqual(rungsOf(null), []);
  });
});

describe("testOrder", () => {
  test("is every test any framework measured, once each, in id order", () => {
    const run: Run = {
      runId: "r",
      frameworks: [framework("dotnet:carter", [], ["json.small", "baseline.plaintext"]), framework("node:fastify", [], ["json.large", "json.small"])],
    };
    assert.deepEqual(testOrder(run), ["baseline.plaintext", "json.large", "json.small"]);
  });
});

describe("familyOf", () => {
  const run: Run = { runId: "r", frameworks: [framework("dotnet:carter", [], ["json.small"])] };

  test("is the family the run recorded", () => {
    assert.equal(familyOf(run, "json.small"), "json");
  });

  test("is the id's prefix where no framework measured the test", () => {
    assert.equal(familyOf(run, "etag.small"), "etag");
  });
});

describe("metaOf", () => {
  test("reads a string from /__meta and nothing else", () => {
    const f = { ...framework("dotnet:carter", [], []), meta: { adapter: "Kestrel", bootMs: 234.6 } };
    assert.equal(metaOf(f, "adapter"), "Kestrel");
    assert.equal(metaOf(f, "bootMs"), "");
    assert.equal(metaOf(f, "serializer"), "");
  });
});

const on = (runId: string, cpu: string, cores = 4, ladder = "ladder-v2", corpusVersion = "sha256:a"): Run => ({
  runId,
  ladder,
  corpusVersion,
  machine: { cpu, cores },
  frameworks: [],
});

describe("machineOf", () => {
  test("names the CPU model and its cores", () => {
    assert.equal(machineOf(on("r", "AMD EPYC 7763 64-Core Processor")), "AMD EPYC 7763 64-Core Processor, 4 cores");
  });

  test("a run that recorded no machine is still named", () => {
    assert.equal(machineOf({ runId: "r", frameworks: [] }), "unknown CPU, ? cores");
  });
});

describe("timeline", () => {
  const intel = "INTEL(R) XEON(R) PLATINUM 8573C";
  const amd = "AMD EPYC 7763 64-Core Processor";

  test("joins only the runs on one machine", () => {
    const runs = [on("a", intel), on("b", amd), on("c", intel), on("d", amd)];
    assert.deepEqual(timeline(runs, runs[3]!, machineOf(runs[0]!)).map((r) => r.runId), ["a", "c"]);
  });

  test("a different core count is a different machine", () => {
    const runs = [on("a", intel, 4), on("b", intel, 2), on("c", intel, 4)];
    assert.deepEqual(timeline(runs, runs[2]!, machineOf(runs[2]!)).map((r) => r.runId), ["a", "c"]);
  });

  test("leaves out runs on another ladder or corpus version, which measured something else", () => {
    const runs = [on("a", intel, 4, "ladder-v1"), on("b", intel, 4, "ladder-v2", "sha256:old"), on("c", intel), on("d", intel)];
    assert.deepEqual(timeline(runs, runs[3]!, machineOf(runs[3]!)).map((r) => r.runId), ["c", "d"]);
  });
});

describe("machinesFor", () => {
  test("puts the newest run's machine first, then the rest by how many runs they have", () => {
    const runs = [on("a", "AMD EPYC 9V74"), on("b", "AMD EPYC 7763"), on("c", "AMD EPYC 7763"), on("d", "INTEL 8573C")];
    assert.deepEqual(machinesFor(runs, runs[3]!), [
      { machine: "INTEL 8573C, 4 cores", runs: 1 },
      { machine: "AMD EPYC 7763, 4 cores", runs: 2 },
      { machine: "AMD EPYC 9V74, 4 cores", runs: 1 },
    ]);
  });

  test("counts only the runs the newest run can be read against", () => {
    const runs = [on("a", "AMD EPYC 7763", 4, "ladder-v1"), on("b", "INTEL 8573C")];
    assert.deepEqual(machinesFor(runs, runs[1]!), [{ machine: "INTEL 8573C, 4 cores", runs: 1 }]);
  });
});
