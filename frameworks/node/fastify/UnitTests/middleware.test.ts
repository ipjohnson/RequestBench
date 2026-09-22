import assert from "node:assert/strict";
import { test } from "node:test";

import { app, expected } from "./app.ts";

// rb:test middleware.none,middleware.four,middleware.sixteen
for (const [id, layers] of [["middleware.none", "none"], ["middleware.four", "four"], ["middleware.sixteen", "sixteen"]] as const) {
  test(`${id}: the hooks in front of the handler leave the answer alone`, async () => {
    const response = await app.inject({ method: "GET", url: `/middleware/${layers}` });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), expected.json("items.small.json"));
  });
}
