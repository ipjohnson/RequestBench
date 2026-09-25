// Which tests a blend takes and what it reads off them. The merge has to give the rung's own
// number when it takes every test, or a blend and All would disagree about the same answers.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { BUCKETS, bucketOf, pct } from "../../traffic-generator/histogram.ts";
import { blendStats, entriesOf, sharesOf, testsOfPick, weightsOf } from "../src/lib/blends.ts";
import { testOrder } from "../src/lib/run.ts";
import type { Framework, Hist, Run, TestRecord } from "../src/lib/types.ts";

/** The generator's histogram with `n` answers at each latency given. */
function counts(at: Record<number, number>): number[] {
  const h = new Array<number>(BUCKETS).fill(0);
  for (const [us, n] of Object.entries(at)) h[bucketOf(Number(us))]! += n;
  return h;
}

/** The same with its empty ends cut off, as a summary carries it. */
function hist(at: Record<number, number>): Hist {
  const h = counts(at);
  const first = h.findIndex((c) => c > 0);
  let last = h.length - 1;
  while (h[last] === 0) last--;
  return { first, counts: h.slice(first, last + 1) };
}

const LATENCY: Record<string, Record<number, number>> = {
  "json.small": { 100: 10 },
  "json.medium": { 200: 8, 260: 2 },
  "static.file": { 400: 10 },
  "template.small": { 900: 9, 4000: 1 },
};

const test_ = (id: string): [string, TestRecord] => [
  id,
  { family: id.split(".")[0]!, rungs: { regular: { count: 10, hist: hist(LATENCY[id]!) } } },
];

const carter: Framework = {
  id: "dotnet:carter",
  language: "dotnet",
  name: "carter",
  families: {},
  rungs: { regular: { rps: 1000, completed: true, achievedRps: 1000 } },
  tests: Object.fromEntries(Object.keys(LATENCY).map(test_)),
};

const run: Run = { runId: "r", frameworks: [carter] };

/** The generator's histograms of these tests summed, each times its weight. */
const merged = (weights: Record<string, number>): number[] => {
  const out = new Array<number>(BUCKETS).fill(0);
  for (const [id, w] of Object.entries(weights)) counts(LATENCY[id]!).forEach((c, i) => (out[i]! += w * c));
  return out;
};

describe("weightsOf", () => {
  test("All takes every test the run measured, and a named blend the ones it names", () => {
    assert.deepEqual([...weightsOf(run, "all", { entries: [], weights: {} }).keys()], testOrder(run));
    assert.deepEqual([...weightsOf(run, "web", { entries: [], weights: {} }).keys()], ["static.file", "template.small"]);
    assert.deepEqual([...weightsOf(run, "api", { entries: [], weights: {} }).keys()], ["json.medium", "json.small"]);
  });

  test("a custom entry is a family or a test, and a family's weight multiplies each of its tests", () => {
    const w = weightsOf(run, "custom", { entries: ["json", "static.file"], weights: { json: 2 } });
    assert.deepEqual([...w], [
      ["json.medium", 2],
      ["json.small", 2],
      ["static.file", 1],
    ]);
  });

  test("a family weighted 0 is left out", () => {
    assert.equal(weightsOf(run, "custom", { entries: ["template"], weights: { template: 0 } }).size, 0);
  });
});

describe("entriesOf", () => {
  test("a family whose every test is taken is written as the family", () => {
    assert.deepEqual(entriesOf(run, ["json.small", "json.medium", "static.file"]), ["json", "static"]);
    assert.deepEqual(entriesOf(run, ["json.small"]), ["json.small"]);
    assert.deepEqual(testsOfPick(run, entriesOf(run, ["json.small", "template.small"])), ["json.small", "template.small"]);
  });
});

describe("blendStats", () => {
  test("reads a blend's percentiles off its tests' histograms merged", () => {
    const s = blendStats(carter, "regular", weightsOf(run, "api", { entries: [], weights: {} }));
    const want = merged({ "json.small": 1, "json.medium": 1 });
    assert.deepEqual(s, { p50Us: pct(want, 50), p90Us: pct(want, 90), p99Us: pct(want, 99), count: 20 });
  });

  test("a weight counts each of a family's answers that many times", () => {
    const s = blendStats(carter, "regular", weightsOf(run, "custom", { entries: ["json", "template"], weights: { template: 3 } }));
    const want = merged({ "json.small": 1, "json.medium": 1, "template.small": 3 });
    assert.equal(s?.p50Us, pct(want, 50));
    assert.equal(s?.p90Us, pct(want, 90));
  });

  test("custom with every family at weight 1 is All", () => {
    const all = weightsOf(run, "all", { entries: [], weights: {} });
    const custom = weightsOf(run, "custom", { entries: entriesOf(run, testOrder(run)), weights: {} });
    assert.deepEqual(blendStats(carter, "regular", custom), blendStats(carter, "regular", all));
    assert.equal(blendStats(carter, "regular", all)?.p50Us, pct(merged({ "json.small": 1, "json.medium": 1, "static.file": 1, "template.small": 1 }), 50));
  });

  test("a framework with no histograms at the rate has no latency", () => {
    const bare: Framework = { ...carter, tests: { "json.small": { family: "json", rungs: { regular: { count: 10 } } } } };
    assert.equal(blendStats(bare, "regular", weightsOf(run, "all", { entries: [], weights: {} })), null);
    assert.equal(blendStats(carter, "raised", weightsOf(run, "all", { entries: [], weights: {} })), null);
  });
});

describe("sharesOf", () => {
  test("is each family's weight over the blend's", () => {
    const shares = sharesOf(run, weightsOf(run, "custom", { entries: ["json", "static"], weights: { json: 2 } }));
    assert.deepEqual([...shares], [
      ["json", 0.8],
      ["static", 0.2],
    ]);
  });
});
