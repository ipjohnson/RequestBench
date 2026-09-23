import assert from "node:assert/strict";
import { test } from "node:test";

import { client, expected } from "./app.ts";

// rb:test json.small,json.medium,json.large
for (const [id, size] of [["json.small", "small"], ["json.medium", "medium"], ["json.large", "large"]] as const) {
  test(`${id}: the payload is written with JSON.stringify`, async () => {
    const response = await client.get(`/json/${size}`);

    assert.equal(response.status, 200);
    assert.match(response.headers["content-type"]!, /^application\/json/);
    assert.deepEqual(response.body, expected.json(`items.${size}.json`));
  });
}
