// What the site leaves out of a summary: each test's histogram and windows.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { withoutHist } from "../src/lib/hist.ts";

const summary = () => ({
  runId: "r",
  histGrid: { growth: 1.02, count: 920 },
  frameworks: [
    {
      id: "dotnet:carter",
      language: "dotnet",
      name: "carter",
      rungs: { regular: { rps: 1000, completed: true } },
      tests: {
        "json.small": {
          family: "json",
          rungs: { regular: { count: 3, p50Us: 120, hist: { first: 240, counts: [2, 0, 1] }, windows: [[3, 120, 130, 140]] } },
        },
        "json.large": { family: "json", rungs: { regular: { count: 1, p50Us: 900, hist: { first: 340, counts: [1] } } } },
      },
      families: {},
    },
    { id: "node:fastify", language: "node", name: "fastify", rungs: {}, tests: {}, families: {} },
  ],
});

describe("withoutHist", () => {
  test("takes every histogram and window out and leaves every other key where it was", () => {
    const kept = JSON.stringify(summary())
      .replaceAll(/,"hist":\{"first":\d+,"counts":\[[\d,]*\]\}/g, "")
      .replaceAll(/,"windows":\[\[[\d,]*\]\]/g, "");
    assert.equal(JSON.stringify(withoutHist(summary())), kept);
  });

  test("a document with no frameworks passes through", () => {
    assert.deepEqual(withoutHist({ runId: "r" }), { runId: "r" });
    assert.equal(withoutHist(null), null);
  });
});
