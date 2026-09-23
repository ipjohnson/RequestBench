import assert from "node:assert/strict";
import { test } from "node:test";

import { client, expected, normal } from "./app.ts";

// rb:test template.small,template.medium
for (const [id, size] of [["template.small", "small"], ["template.medium", "medium"]] as const) {
  test(`${id}: the payload is rendered by the EJS template`, async () => {
    const response = await client.get(`/template/${size}`);

    assert.equal(response.status, 200);
    assert.match(response.headers["content-type"]!, /^text\/html/);
    assert.equal(normal(response.text), expected.page(`items.${size}.json`));
  });
}
