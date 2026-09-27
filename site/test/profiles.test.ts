// Which tests a profile takes and what it reads off them. A profile's percentiles are the
// geometric mean of its tests' own, so a change of 10% in any one test moves the profile by the
// same amount.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { entriesOf, profileNamed, profileStats, sharesOf, testsOfPick, weightsOf } from "../src/lib/profiles.ts";
import { testOrder } from "../src/lib/run.ts";
import type { Framework, Run, TestRecord } from "../src/lib/types.ts";

/** Each test's heft. */
const HEFT: Record<string, number> = { "json.small": 1, "json.medium": 2, "static.file": 4, "template.small": 2 };

/** Each test's p50, p90 and p99 at the regular rate, chosen so the means come out round. */
const LATENCY: Record<string, [number, number, number]> = {
  "json.small": [100, 150, 200],
  "json.medium": [400, 600, 800],
  "static.file": [1600, 2400, 3200],
  "template.small": [6400, 9600, 12800],
};

const test_ = (id: string): [string, TestRecord] => {
  const [p50Us, p90Us, p99Us] = LATENCY[id]!;
  return [id, { family: id.split(".")[0]!, heft: HEFT[id], rungs: { regular: { count: 10, p50Us, p90Us, p99Us } } }];
};

const carter: Framework = {
  id: "dotnet:carter",
  language: "dotnet",
  name: "carter",
  families: {},
  rungs: { regular: { rps: 1000, completed: true, achievedRps: 1000 } },
  tests: Object.fromEntries(Object.keys(LATENCY).map(test_)),
};

const run: Run = { runId: "r", frameworks: [carter] };

/** Equal but for the last places, which a mean taken through logarithms can leave. */
const near = (actual: number | null, want: number): void =>
  assert.ok(actual !== null && Math.abs(actual - want) < want * 1e-12, `${actual} is not ${want}`);

describe("weightsOf", () => {
  test("all takes every test the run measured, and a named profile the ones it names", () => {
    assert.deepEqual([...weightsOf(run, "all", { entries: [], weights: {} }).keys()], testOrder(run));
    assert.deepEqual([...weightsOf(run, "web-all", { entries: [], weights: {} }).keys()], ["static.file", "template.small"]);
    assert.deepEqual([...weightsOf(run, "api-all", { entries: [], weights: {} }).keys()], ["json.medium", "json.small"]);
    assert.deepEqual([...weightsOf(run, "api-validation", { entries: [], weights: {} }).keys()], []);
  });

  test("a light profile takes its kind's tests the run recorded at heft 2 and under", () => {
    assert.deepEqual([...weightsOf(run, "web-light", { entries: [], weights: {} }).keys()], ["template.small"]);
    assert.deepEqual([...weightsOf(run, "api-light", { entries: [], weights: {} }).keys()], ["json.medium", "json.small"]);
  });

  test("a light profile leaves out a test the run recorded no heft for", () => {
    const tests = Object.fromEntries(Object.entries(carter.tests).map(([id, t]) => [id, { ...t, heft: undefined }]));
    const older: Run = { runId: "r", frameworks: [{ ...carter, tests }] };
    assert.equal(weightsOf(older, "web-light", { entries: [], weights: {} }).size, 0);
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

describe("profileNamed", () => {
  test("finds a profile by its id in any case, and a name from before profiles by the profile it became", () => {
    assert.deepEqual(
      ["web-light", "API-VALIDATION", "Web", "api", "All", "Custom", "json"].map(profileNamed),
      ["web-light", "api-validation", "web-all", "api-all", "all", "custom", null],
    );
  });
});

describe("entriesOf", () => {
  test("a family whose every test is taken is written as the family", () => {
    assert.deepEqual(entriesOf(run, ["json.small", "json.medium", "static.file"]), ["json", "static"]);
    assert.deepEqual(entriesOf(run, ["json.small"]), ["json.small"]);
    assert.deepEqual(testsOfPick(run, entriesOf(run, ["json.small", "template.small"])), ["json.small", "template.small"]);
  });
});

describe("profileStats", () => {
  const none = { entries: [], weights: {} };

  test("reads each percentile as the geometric mean of its tests' own, from all of their requests", () => {
    const s = profileStats(carter, "regular", weightsOf(run, "api-all", none));
    near(s.p50Us, 200);
    near(s.p90Us, 300);
    near(s.p99Us, 400);
    assert.equal(s.count, 20);
  });

  test("a family's weight counts each of its tests that many times", () => {
    const s = profileStats(carter, "regular", weightsOf(run, "custom", { entries: ["json", "template"], weights: { template: 3 } }));
    // (100 × 400 × 6400³)^(1/5)
    near(s.p50Us, 1600);
  });

  test("custom with every family at weight 1 is All, which takes every test", () => {
    const all = weightsOf(run, "all", none);
    const custom = weightsOf(run, "custom", { entries: entriesOf(run, testOrder(run)), weights: {} });
    assert.deepEqual(profileStats(carter, "regular", custom), profileStats(carter, "regular", all));
    // (100 × 400 × 1600 × 6400)^(1/4)
    near(profileStats(carter, "regular", all).p50Us, 800);
  });

  test("a change of 10% in any one test moves the profile by the same amount, whatever the test's size", () => {
    const all = weightsOf(run, "all", none);
    const before = profileStats(carter, "regular", all).p50Us!;
    for (const id of testOrder(run)) {
      const own = carter.tests[id]!;
      const at = own.rungs!["regular"]!;
      const slower: Framework = { ...carter, tests: { ...carter.tests, [id]: { ...own, rungs: { regular: { ...at, p50Us: at.p50Us! * 1.1 } } } } };
      near(profileStats(slower, "regular", all).p50Us! / before, 1.1 ** (1 / 4));
    }
  });

  test("a test with no answers at the rate is left out", () => {
    const quiet: Framework = { ...carter, tests: { ...carter.tests, "json.medium": { family: "json", rungs: { regular: { count: 0, p50Us: 0, p90Us: 0, p99Us: 0 } } } } };
    const s = profileStats(quiet, "regular", weightsOf(run, "api-all", none));
    near(s.p50Us, 100);
    near(s.p99Us, 200);
  });

  test("a framework with no percentiles at the rate has no latency", () => {
    const bare: Framework = { ...carter, tests: { "json.small": { family: "json", rungs: { regular: { count: 10 } } } } };
    const pcts = (s: { p50Us: number | null; p90Us: number | null; p99Us: number | null }) => [s.p50Us, s.p90Us, s.p99Us];
    assert.deepEqual(pcts(profileStats(bare, "regular", weightsOf(run, "all", none))), [null, null, null]);
    assert.deepEqual(profileStats(carter, "raised", weightsOf(run, "all", none)), { p50Us: null, p90Us: null, p99Us: null, count: 0 });
  });
});

describe("sharesOf", () => {
  test("is each family's weight over the profile's", () => {
    const shares = sharesOf(run, weightsOf(run, "custom", { entries: ["json", "static"], weights: { json: 2 } }));
    assert.deepEqual([...shares], [
      ["json", 0.8],
      ["static", 0.2],
    ]);
  });
});
