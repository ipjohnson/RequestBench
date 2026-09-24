// A run file collapsed for the site, from a result whose histograms the test chooses.
import assert from "node:assert/strict";
import { test } from "node:test";

import { BUCKETS, bucketOf, pct } from "../../traffic-generator/histogram.ts";
import type { LoadResult, PhaseResult, TestSummary } from "../../traffic-generator/load.ts";
import type { RunFile } from "../measure.ts";
import { BIN_GRID, HIST_GRID, rebin, summarize, trim } from "../summarize.ts";

/** A histogram with `n` answers at each latency given, as the generator encodes one. */
function hist(at: Record<number, number>): string {
  const h = new Uint32Array(BUCKETS);
  for (const [us, n] of Object.entries(at)) h[bucketOf(Number(us))]! += n;
  return Buffer.from(h.buffer).toString("base64");
}

const testRow = (id: string, family: string, at: Record<number, number>): TestSummary => {
  const count = Object.values(at).reduce((a, b) => a + b, 0);
  return { id, family, count, errors: 0, mismatch: 0, dropped: 0, p50Us: 0, p90Us: 0, p99Us: 0, p999Us: 0, histB64: hist(at) };
};

const recorded = (tests: TestSummary[], dropped = 0) => ({
  seconds: 1,
  elapsedSeconds: 1,
  achievedRps: 100,
  scheduled: 100,
  completed: 100 - dropped,
  dropped,
  errors: 0,
  mismatch: 0,
  unrecorded: 0,
  overall: { count: 100, p50Us: 0, p90Us: 0, p99Us: 0, p999Us: 0 },
  tests,
});
const settle = { seconds: 1, scheduled: 100, completed: 100, achievedRps: 90, dropped: 30, dropFraction: 0.3, errors: 0, mismatch: 0, p50Us: 0, p99Us: 0 };

const phases: PhaseResult[] = [
  { name: "warmup", rps: 1000, status: "done", settle: { ...settle, dropped: 0, dropFraction: 0 }, unfinished: 0 },
  {
    name: "regular",
    rps: 100,
    status: "done",
    recorded: recorded([testRow("json.small", "json", { 150: 60, 200: 20 }), testRow("json.large", "json", { 900: 19, 5000: 1 })]),
    unfinished: 0,
  },
  { name: "raised", rps: 200, status: "done", recorded: recorded([testRow("json.small", "json", { 150: 97 })], 3), unfinished: 0 },
  { name: "peak", rps: 400, status: "aborted", settle, unfinished: 0 },
  { name: "beyond", rps: 800, status: "notRun" },
];

const load: LoadResult = {
  load: {
    target: "127.0.0.1:1",
    framework: "node:fastify",
    values: {} as LoadResult["load"]["values"],
    workers: 1,
    instances: 1,
    connections: 8,
    phases: [
      { name: "warmup", rps: 1000, settle: 1 },
      { name: "regular", rps: 100, seconds: 1 },
      { name: "raised", rps: 200, seconds: 1 },
      { name: "peak", rps: 400, settle: 1, seconds: 1, abortDropFraction: 0.05 },
      { name: "beyond", rps: 800, seconds: 1 },
    ],
  },
  testsLive: 2,
  phases,
};

const run = {
  runId: "2026-09-21T2300Z.container-h1.abcdef",
  host: "container-h1",
  recorded: false,
  notRecorded: ["a test"],
  started: "2026-09-21T23:00:00.000Z",
  finished: "2026-09-21T23:10:00.000Z",
  commit: "0".repeat(40),
  repo: "example/repo",
  ladder: "ladder-v1",
  values: load.load.values,
  tests: { bundleHash: "sha256:a", codeHash: "sha256:b", corpusVersion: "sha256:c" },
  generator: "sha256:d",
  machine: { available: false, cpu: "x", cores: 1, platform: "x" },
  budget: { cpus: "2" },
  tools: { node: "v26" },
  frameworks: [
    { id: "node:fastify", ordinal: 1, bundleHash: "sha256:e", codeHash: "sha256:f", meta: { framework: "Fastify", version: "5.6.0", runtime: "node 26" }, load },
    { id: "python:fastapi", ordinal: 2, bundleHash: "sha256:g", codeHash: "sha256:h", error: "it failed the gate, so it was not measured" },
  ],
} satisfies RunFile;

test("a completed rung publishes every test's percentiles and histogram, and the warmup is not a rung", () => {
  const s = summarize(run);
  assert.deepEqual(s.binGrid, BIN_GRID);
  const f = s.frameworks[0]!;
  assert.deepEqual([f.framework, f.version, f.runtime], ["Fastify", "5.6.0", "node 26"]);
  assert.deepEqual(Object.keys(f.rungs), ["regular", "raised", "peak", "beyond"]);
  const small = f.tests["json.small"]!.rungs["regular"]!;
  assert.equal(small.count, 80);
  assert.equal(small.bins.reduce((a, b) => a + b, 0), 80);
  const decoded = new Uint32Array(BUCKETS);
  decoded[bucketOf(150)] = 60;
  decoded[bucketOf(200)] = 20;
  assert.equal(small.p50Us, pct(decoded, 50));
  assert.deepEqual(small.bins, rebin(decoded));
  assert.equal(f.rungs["regular"]!.completed, true);
  assert.equal(f.families["regular"]!["json"]!.count, 100);
});

test("each test carries the generator's histogram with its empty ends cut off", () => {
  const s = summarize(run);
  assert.deepEqual(s.histGrid, HIST_GRID);
  const hist = s.frameworks[0]!.tests["json.small"]!.rungs["regular"]!.hist;
  assert.equal(hist.first, bucketOf(150));
  assert.equal(hist.counts.length, bucketOf(200) - bucketOf(150) + 1);
  assert.deepEqual([hist.counts[0], hist.counts.at(-1), hist.counts.reduce((a, b) => a + b, 0)], [60, 20, 80]);
  assert.deepEqual(trim(new Uint32Array(BUCKETS)), { first: 0, counts: [] });
});

test("the tests' histograms merged give the rung's own percentiles", () => {
  const f = summarize(run).frameworks[0]!;
  const merged = new Array<number>(BUCKETS).fill(0);
  for (const t of Object.values(f.tests)) {
    const h = t.rungs["regular"]?.hist;
    h?.counts.forEach((c, i) => (merged[h.first + i]! += c));
  }
  const rung = f.rungs["regular"]!;
  assert.deepEqual([rung.p50Us, rung.p90Us, rung.p99Us], [pct(merged, 50), pct(merged, 90), pct(merged, 99)]);
});

test("a rung with drops, an aborted rung and a rung never run publish no latency", () => {
  const f = summarize(run).frameworks[0]!;
  const raised = f.rungs["raised"]!;
  assert.deepEqual([raised.completed, raised.saturated, raised.p50Us], [false, true, null]);
  assert.equal(f.tests["json.small"]!.rungs["raised"], undefined);
  const peak = f.rungs["peak"]!;
  assert.deepEqual([peak.status, peak.completed, peak.achievedRps, peak.dropped, peak.p99Us], ["aborted", false, 90, 30, null]);
  assert.deepEqual([f.rungs["beyond"]!.status, f.rungs["beyond"]!.p50Us], ["notRun", null]);
  const unmeasured = summarize(run).frameworks[1]!;
  assert.deepEqual(unmeasured.rungs, {});
  assert.equal(unmeasured.error, "it failed the gate, so it was not measured");
});

test("the tests a framework does not support on the run's host travel with it, and a framework with none has no entry", () => {
  const unsupported = { "sse.medium": "the runtime client has no response streaming" };
  const s = summarize({ ...run, frameworks: [{ ...run.frameworks[0]!, unsupported }, run.frameworks[1]!] });
  assert.deepEqual(s.frameworks[0]!.unsupported, unsupported);
  assert.equal("unsupported" in s.frameworks[1]!, false);
});
