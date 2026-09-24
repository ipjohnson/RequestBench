// Each test's windows as the framework page draws them.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { logTicks, windowingOf, windowSpan } from "../src/lib/windows.ts";

const grid = { seconds: 10, fields: ["count", "p50Us", "p90Us", "p99Us"] };

describe("windowingOf", () => {
  test("finds each number by its name in the grid", () => {
    assert.deepEqual(windowingOf(grid), { seconds: 10, places: { count: 0, p50: 1, p90: 2, p99: 3 } });
    assert.deepEqual(windowingOf({ seconds: 5, fields: ["p99Us", "p90Us", "p50Us", "count"] })?.places, {
      count: 3,
      p50: 2,
      p90: 1,
      p99: 0,
    });
  });

  test("a summary with no windows, or without a number the chart reads, has none to draw", () => {
    assert.equal(windowingOf(undefined), null);
    assert.equal(windowingOf({ seconds: 10, fields: ["count", "p50Us", "p99Us"] }), null);
  });
});

describe("windowSpan", () => {
  const places = windowingOf(grid)!.places;

  test("runs from the test's lowest p50 to its highest p99, with a tenth of a decade to spare", () => {
    const span = windowSpan([[100, 200, 400, 900], [0, 0, 0, 0], [100, 3000, 5000, 20000]], places)!;
    assert.ok(Math.abs(Math.log10(span.lo) - (Math.log10(200) - 0.1)) < 1e-9);
    assert.ok(Math.abs(Math.log10(span.hi) - (Math.log10(20000) + 0.1)) < 1e-9);
  });

  test("is a decade tall at least, around the middle of what was measured", () => {
    const span = windowSpan([[10, 150, 160, 170]], places)!;
    assert.ok(Math.abs(Math.log10(span.hi) - Math.log10(span.lo) - 1) < 1e-9);
    assert.ok(span.lo < 150 && span.hi > 170);
  });

  test("a test with no counted window has none", () => {
    assert.equal(windowSpan([], places), null);
    assert.equal(windowSpan([[0, 0, 0, 0]], places), null);
  });
});

describe("logTicks", () => {
  test("the decades when three fall inside", () => {
    assert.deepEqual(logTicks(50, 20000), [100, 1000, 10000]);
  });

  test("ones and threes, then ones, twos and fives, on a narrower axis", () => {
    assert.deepEqual(logTicks(80, 3500), [100, 300, 1000, 3000]);
    assert.deepEqual(logTicks(120, 1300), [200, 500, 1000]);
  });
});
