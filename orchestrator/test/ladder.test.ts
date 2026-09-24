// A ladder's version names its numbers, because the site reads runs with the same version against
// each other.
import assert from "node:assert/strict";
import { test } from "node:test";

import { LADDERS } from "../ladder.ts";

test("two ladders share a version only where their numbers are the same", () => {
  const seen = new Map<string, unknown>();
  for (const [id, ladder] of Object.entries(LADDERS)) {
    for (const loop of [ladder.open, ladder.closed]) {
      const other = seen.get(loop.version);
      if (other !== undefined) assert.deepEqual(loop, other, `${id} gives ${loop.version} other numbers`);
      seen.set(loop.version, loop);
    }
  }
});
