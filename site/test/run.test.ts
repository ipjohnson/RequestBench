// The lists a summary does not write down: its rungs, its tests and its languages.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { familyOf, metaOf, rungsOf, testOrder } from "../src/lib/run.ts";
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
