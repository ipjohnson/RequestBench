import assert from "node:assert/strict";
import { test } from "node:test";

import { app, expected, normal } from "./app.ts";

// rb:test template.small,template.medium
for (const [id, size] of [["template.small", "small"], ["template.medium", "medium"]] as const) {
  test(`${id}: the payload is rendered by the EJS template`, async () => {
    const response = await app.inject({ method: "GET", url: `/template/${size}` });

    assert.equal(response.statusCode, 200);
    assert.match(response.headers["content-type"] as string, /^text\/html/);
    assert.equal(normal(response.body), expected.page(`items.${size}.json`));
  });
}
