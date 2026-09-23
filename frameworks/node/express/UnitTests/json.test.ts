import assert from "node:assert/strict";
import { test } from "node:test";

import request from "supertest";

import { app, expected } from "./app.ts";

// rb:test json.small,json.medium,json.large
for (const [id, size] of [["json.small", "small"], ["json.medium", "medium"], ["json.large", "large"]] as const) {
  test(`${id}: the payload is written by res.json`, async () => {
    const response = await request(app).get(`/json/${size}`);

    assert.equal(response.status, 200);
    assert.match(response.headers["content-type"]!, /^application\/json/);
    assert.deepEqual(response.body, expected.json(`items.${size}.json`));
  });
}

test("a json answer carries no tag, because the application turns Express's etag setting off", async () => {
  const response = await request(app).get("/json/large");

  assert.equal(response.headers["etag"], undefined);
});
