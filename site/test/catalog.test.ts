// What the catalog says about each run, and what the page says the catalog holds.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { BUCKETS, GROWTH } from "../../traffic-generator/histogram.ts";
import { buildCatalog, newestPerHost, provenance, runEntry } from "../src/lib/catalog.ts";
import type { Run } from "../src/lib/types.ts";

const run = (id: string, host?: string): Run => ({
  runId: id,
  date: id.slice(0, 10),
  ...(host === undefined ? {} : { host }),
  ladder: "ladder-v1",
  corpusVersion: "sha256:e0135cc870db5f67aeee18f1953238583d8ed5cf3276c59cbaeca5ce0a14a6a0",
  recorded: true,
  machine: { cpu: "AMD EPYC", cores: 16 },
  frameworks: [
    { id: "python:fastapi", language: "python", name: "fastapi", rungs: {}, tests: {}, families: {} },
    { id: "dotnet:carter", language: "dotnet", name: "carter", rungs: {}, tests: {}, families: {} },
  ],
});

describe("runEntry", () => {
  test("carries what the controls need, read off the summary", () => {
    assert.deepEqual(runEntry(run("2026-09-21T2331Z.container-h1.5d0c44", "container-h1")), {
      id: "2026-09-21T2331Z.container-h1.5d0c44",
      file: "2026-09-21T2331Z.container-h1.5d0c44.json.gz",
      hist: "",
      date: "2026-09-21",
      languages: ["dotnet", "python"],
      host: "container-h1",
      ladder: "ladder-v1",
      corpus: "sha256:e0135cc870db5f67aeee18f1953238583d8ed5cf3276c59cbaeca5ce0a14a6a0",
      recorded: true,
      cpu: "AMD EPYC",
      cores: 16,
    });
  });

  test("a file name never carries a colon", () => {
    assert.equal(runEntry(run("2026-09-21T23:31Z.x")).file, "2026-09-21T2331Z.x.json.gz");
  });

  test("a summary with no host was measured on the only host there has been", () => {
    assert.equal(runEntry(run("r")).host, "container-h1");
  });

  test("a summary whose tests carry histograms names the document they are published in", () => {
    const measured = run("2026-09-21T2331Z.x");
    measured.frameworks[0]!.tests = { "json.small": { family: "json", rungs: { regular: { hist: { first: 240, counts: [1] } } } } };
    assert.equal(runEntry(measured).hist, "");
    measured.histGrid = { growth: GROWTH, count: BUCKETS };
    assert.equal(runEntry(measured).hist, "2026-09-21T2331Z.x.hist.json.gz");
  });
});

describe("provenance", () => {
  test("names the ladder and the corpus version the page is showing", () => {
    const c = buildCatalog([run("a", "container-h1")], {}, [], "");
    assert.deepEqual(provenance(c), { eyebrow: "ladder-v1 · corpus e0135cc870db", runs: 1 });
  });

  test("an empty catalog says so", () => {
    assert.deepEqual(provenance(buildCatalog([], {}, [], "")), { eyebrow: "no runs", runs: 0 });
  });
});

describe("newestPerHost", () => {
  test("keeps one run per host, the newest", () => {
    const kept = newestPerHost([run("2026-09-20", "container-h1"), run("2026-09-21", "container-h1"), run("2026-09-19", "container-h2")]);
    assert.deepEqual(kept.map((r) => r.runId).sort(), ["2026-09-19", "2026-09-21"]);
  });
});
