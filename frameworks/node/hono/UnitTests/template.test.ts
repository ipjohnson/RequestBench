import assert from "node:assert/strict";
import { test } from "node:test";

import { app, expected, normal } from "./app.ts";

// rb:test template.small,template.medium
for (const [id, size] of [["template.small", "small"], ["template.medium", "medium"]] as const) {
  test(`${id}: the payload is rendered by the html helper`, async () => {
    const response = await app.request(`/template/${size}`);

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type")!, /^text\/html/);
    assert.equal(normal(await response.text()), expected.page(`items.${size}.json`));
  });
}

test("a value the page interpolates is escaped", async () => {
  const { html } = await import("hono/html");

  assert.equal(String(await html`<td>${"<b>&"}</td>`), "<td>&lt;b&gt;&amp;</td>");
});
