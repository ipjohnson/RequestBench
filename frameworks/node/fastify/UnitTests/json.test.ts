import assert from "node:assert/strict";
import { test } from "node:test";

import { app, expected } from "./app.ts";

// rb:test json.small,json.medium,json.large
for (const [id, size] of [["json.small", "small"], ["json.medium", "medium"], ["json.large", "large"]] as const) {
  test(`${id}: the payload is written by its response schema`, async () => {
    const response = await app.inject({ method: "GET", url: `/json/${size}` });

    assert.equal(response.statusCode, 200);
    assert.match(response.headers["content-type"] as string, /^application\/json/);
    assert.deepEqual(response.json(), expected.json(`items.${size}.json`));
  });
}
