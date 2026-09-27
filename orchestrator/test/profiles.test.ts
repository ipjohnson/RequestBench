// The site's named profiles against the corpus. A profile is read over tests every run measures,
// so a name that is not a performance test would leave the profile short without saying so.
import assert from "node:assert/strict";
import { test } from "node:test";

import corpus from "@rb/tests";
import { LIGHT, LIGHT_OF, NAMED } from "../../site/src/lib/profiles.ts";

const performance = Object.fromEntries(
  Object.entries(corpus.tests).flatMap(([id, t]) => (t.kind === "performance" ? [[id, t.heft]] : [])),
);

test("every test a named profile takes is a performance test, taken once", () => {
  for (const [name, profile] of Object.entries(NAMED)) {
    assert.deepEqual(
      profile.tests.filter((id) => !(id in performance)),
      [],
      `${name} names tests the corpus does not measure`,
    );
    assert.equal(new Set(profile.tests).size, profile.tests.length, `${name} names a test twice`);
  }
});

test("a light profile keeps some of its kind's tests at the corpus's hefts, and leaves some out", () => {
  for (const [light, from] of Object.entries(LIGHT_OF)) {
    const kept = NAMED[from].tests.filter((id) => performance[id]! <= LIGHT);
    assert.ok(kept.length > 0 && kept.length < NAMED[from].tests.length, `${light} keeps ${kept.length} of ${from}'s tests`);
  }
});
