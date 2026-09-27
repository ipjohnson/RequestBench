// Which percentiles are thin: fewer than ten of the requests they are read from lie beyond them.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { beyond, beyondLabel, isThin, thinTitle } from "../src/lib/thin.ts";

describe("isThin", () => {
  test("is a p99 over fewer than 1,000 requests, a p90 over fewer than 100 and a p50 over fewer than 20", () => {
    assert.deepEqual([isThin(999, "p99Us"), isThin(1000, "p99Us")], [true, false]);
    assert.deepEqual([isThin(99, "p90Us"), isThin(100, "p90Us")], [true, false]);
    assert.deepEqual([isThin(19, "p50Us"), isThin(20, "p50Us")], [true, false]);
  });

  test("is never a number over no requests, or a number that is no percentile", () => {
    assert.deepEqual([isThin(0, "p99Us"), isThin(undefined, "p99Us"), isThin(5, "achievedRps")], [false, false, false]);
  });
});

describe("beyond", () => {
  test("counts the whole requests past the percentile", () => {
    assert.deepEqual([beyond(154, "p99Us"), beyond(154, "p90Us"), beyond(154, "p50Us")], [1, 15, 77]);
  });
});

describe("what a thin value says", () => {
  test("beside the number and in its title", () => {
    assert.deepEqual([beyondLabel(0), beyondLabel(3)], ["none beyond", "3 beyond"]);
    assert.equal(thinTitle(308, "p99Us", "p99"), "Thin: 3 of its 308 requests lie beyond this p99, fewer than 10.");
    assert.equal(thinTitle(154, "p99Us", "p99"), "Thin: 1 of its 154 requests lies beyond this p99, fewer than 10.");
    assert.equal(thinTitle(80, "p99Us", "p99"), "Thin: none of its 80 requests lie beyond this p99.");
  });
});
