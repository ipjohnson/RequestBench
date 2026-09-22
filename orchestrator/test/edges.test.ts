// Each test's base edge: what it is read against and the one factor that differs.
import assert from "node:assert/strict";
import { test } from "node:test";

import corpus from "@rb/tests";
import { family, performanceTest, suite, validationTest } from "@rb/tests/kit";
import type { PerformanceTest, Test } from "@rb/tests/kit";

const row = (name: string, edge: { base: string; varies: string } | Record<string, never> = {}) =>
  performanceTest({ id: { family: "f", name }, path: `/${name}`, about: name, request: (c) => c.get(`/${name}`).ok(), ...edge });

const suiteOf = (tests: Test[], factors: Record<string, { reads: string }> = { size: { reads: "bigger" } }) =>
  suite([family({ name: "f", about: "", comparable: "", tests })], factors);

test("every chain in the corpus ends at a root, and every factor is varied", () => {
  const measured = Object.entries(corpus.tests).filter((e): e is [string, PerformanceTest] => e[1].kind === "performance");
  const roots = measured.filter(([, t]) => t.base === undefined).map(([id]) => id).sort();
  assert.deepEqual(roots, ["baseline.plaintext", "body.bind_small", "errors.unmatched", "headers.few", "json.small"]);
  assert.equal(measured.length - roots.length, 51);
  const varied = new Set(measured.map(([, t]) => t.varies).filter((v) => v !== undefined));
  assert.deepEqual([...varied].sort(), Object.keys(corpus.factors).sort());
});

test("a base has to be a measured test, and what varies has to be a factor", () => {
  assert.doesNotThrow(() => suiteOf([row("a"), row("b", { base: "f.a", varies: "size" })]));
  assert.throws(() => suiteOf([row("a"), row("b", { base: "f.nope", varies: "size" })]), /f\.b is read against f\.nope, which is not a test/);
  assert.throws(() => suiteOf([row("a"), row("b", { base: "f.a", varies: "colour" }), row("c", { base: "f.a", varies: "size" })]), /f\.b varies colour, which is not a factor/);
  const v = validationTest({ id: { family: "f", name: "v" }, about: "v", request: (c) => c.get("/v").ok() });
  assert.throws(() => suiteOf([v, row("b", { base: "f.v", varies: "size" })]), /f\.b is read against f\.v, which is never timed/);
});

test("a chain has to end, and a factor nothing varies is refused", () => {
  assert.throws(
    () => suiteOf([row("a", { base: "f.b", varies: "size" }), row("b", { base: "f.a", varies: "size" })]),
    /the base chain from f\.\w comes back to f\.\w/,
  );
  assert.throws(() => suiteOf([row("a")]), /no test varies size/);
});
