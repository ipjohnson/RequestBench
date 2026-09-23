import assert from "node:assert/strict";
import { test } from "node:test";

import request from "supertest";

import { app, expected } from "./app.ts";

// rb:test static.file
test("static.file: the committed file is served byte for byte", async () => {
  const file = expected.bytes("items.large.json");

  const response = await request(app).get("/static/items.large.json");

  assert.equal(response.status, 200);
  assert.match(response.headers["content-type"]!, /^application\/json/);
  assert.equal(response.headers["content-length"], String(file.length));
  assert.notEqual(response.headers["last-modified"], undefined);
  assert.equal(response.text, file.toString("utf8"));
});
