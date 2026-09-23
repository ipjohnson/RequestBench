// The site's named blends against the corpus. A blend is read over tests every run measures, so
// a name that is not a performance test would leave the blend short without saying so.
import assert from "node:assert/strict";
import { test } from "node:test";

import corpus from "@rb/tests";
import { NAMED } from "../../site/src/lib/blends.ts";

test("every test a named blend takes is a performance test, taken once", () => {
  const measured = new Set(
    Object.entries(corpus.tests)
      .filter(([, t]) => t.kind === "performance")
      .map(([id]) => id),
  );
  for (const [name, blend] of Object.entries(NAMED)) {
    assert.deepEqual(
      blend.tests.filter((id) => !measured.has(id)),
      [],
      `${name} names tests the corpus does not measure`,
    );
    assert.equal(new Set(blend.tests).size, blend.tests.length, `${name} names a test twice`);
  }
});
