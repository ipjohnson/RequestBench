import assert from "node:assert/strict";
import { test } from "node:test";

import request from "supertest";

import { app, expected, normal } from "./app.ts";

// rb:test template.small,template.medium
for (const [id, size] of [["template.small", "small"], ["template.medium", "medium"]] as const) {
  test(`${id}: the payload is rendered by the Pug view`, async () => {
    const response = await request(app).get(`/template/${size}`);

    assert.equal(response.status, 200);
    assert.match(response.headers["content-type"]!, /^text\/html/);
    assert.equal(normal(response.text), expected.page(`items.${size}.json`));
  });
}

test("rendering leaves the payload the json rows write alone", async () => {
  await request(app).get("/template/small");

  const response = await request(app).get("/json/small");

  assert.deepEqual(response.body, expected.json("items.small.json"));
});
