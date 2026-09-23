import assert from "node:assert/strict";
import { test } from "node:test";

import { app, expected } from "./app.ts";

// rb:test json.small,json.medium,json.large
for (const [id, size] of [["json.small", "small"], ["json.medium", "medium"], ["json.large", "large"]] as const) {
  test(`${id}: the payload is written by JSON.stringify`, async () => {
    const response = await app.request(`/json/${size}`);

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type")!, /^application\/json/);
    assert.deepEqual(await response.json(), expected.json(`items.${size}.json`));
  });
}
