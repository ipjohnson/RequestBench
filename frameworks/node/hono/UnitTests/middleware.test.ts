import assert from "node:assert/strict";
import { test } from "node:test";

import { app, expected } from "./app.ts";

// rb:test middleware.none,middleware.four,middleware.sixteen
for (const [id, layers] of [["middleware.none", "none"], ["middleware.four", "four"], ["middleware.sixteen", "sixteen"]] as const) {
  test(`${id}: the middleware in front of the handler leaves the answer alone`, async () => {
    const response = await app.request(`/middleware/${layers}`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), expected.json("items.small.json"));
  });
}

test("each route runs its own number of layers", () => {
  const handlers = (path: string) => app.router.match("GET", path)[0].length;

  assert.deepEqual([handlers("/middleware/none"), handlers("/middleware/four"), handlers("/middleware/sixteen")], [1, 5, 17]);
});
