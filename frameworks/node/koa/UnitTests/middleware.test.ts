import assert from "node:assert/strict";
import { test } from "node:test";

import { client, expected } from "./app.ts";

// rb:test middleware.none,middleware.four,middleware.sixteen
for (const [id, layers] of [["middleware.none", "none"], ["middleware.four", "four"], ["middleware.sixteen", "sixteen"]] as const) {
  test(`${id}: the middleware in front of the handler leaves the answer alone`, async () => {
    const response = await client.get(`/middleware/${layers}`);

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, expected.json("items.small.json"));
  });
}
