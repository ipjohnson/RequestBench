// A summary's histograms, published beside the run and put back when a blend needs them.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { BUCKETS, GROWTH } from "../../traffic-generator/histogram.ts";
import { attachHist, hasHist, histUsable, splitHist, withoutHist } from "../src/lib/hist.ts";
import type { Run } from "../src/lib/types.ts";

const summary = (): Run => ({
  runId: "r",
  histGrid: { growth: GROWTH, count: BUCKETS },
  frameworks: [
    {
      id: "dotnet:carter",
      language: "dotnet",
      name: "carter",
      rungs: { regular: { rps: 1000, completed: true } },
      tests: {
        "json.small": { family: "json", rungs: { regular: { count: 3, p50Us: 120, hist: { first: 240, counts: [2, 0, 1] } } } },
        "json.large": { family: "json", rungs: { regular: { count: 1, p50Us: 900, hist: { first: 340, counts: [1] } } } },
      },
      families: {},
    },
    { id: "node:fastify", language: "node", name: "fastify", rungs: {}, tests: {}, families: {} },
  ],
});

describe("splitHist", () => {
  test("takes every histogram out and leaves every other key where it was", () => {
    const { run, hist } = splitHist(summary());
    assert.deepEqual(hist, {
      "dotnet:carter": {
        "json.small": { regular: { first: 240, counts: [2, 0, 1] } },
        "json.large": { regular: { first: 340, counts: [1] } },
      },
    });
    const kept = JSON.stringify(summary()).replaceAll(/,"hist":\{"first":\d+,"counts":\[[\d,]*\]\}/g, "");
    assert.equal(JSON.stringify(run), kept);
  });

  test("leaves each test's windows out of the run, and out of the histograms", () => {
    const windowed = summary();
    windowed.frameworks[0]!.tests["json.small"]!.rungs!["regular"]!.windows = [[3, 120, 130, 140]];
    const { run, hist } = splitHist(windowed);
    assert.equal(JSON.stringify(run).includes("windows"), false);
    assert.equal(JSON.stringify(hist).includes("windows"), false);
    assert.equal(JSON.stringify(withoutHist(windowed)).includes("windows"), false);
  });

  test("a document with no frameworks passes through", () => {
    assert.deepEqual(splitHist({ runId: "r" }), { run: { runId: "r" }, hist: {} });
    assert.deepEqual(splitHist(null), { run: null, hist: {} });
  });
});

describe("attachHist", () => {
  test("puts each histogram back where the summary had it", () => {
    const run = withoutHist(summary());
    assert.equal(hasHist(run), false);
    attachHist(run, splitHist(summary()).hist);
    assert.deepEqual(run, summary());
  });
});

describe("histUsable", () => {
  test("only a run counted on this page's grid", () => {
    assert.equal(histUsable(summary()), true);
    assert.equal(histUsable({ ...summary(), histGrid: { growth: 1.05, count: BUCKETS } }), false);
    const { histGrid: _, ...older } = summary();
    assert.equal(histUsable(older), false);
  });
});
