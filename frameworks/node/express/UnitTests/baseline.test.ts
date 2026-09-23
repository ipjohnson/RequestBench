import assert from "node:assert/strict";
import { test } from "node:test";

import request from "supertest";

import { app } from "./app.ts";

// rb:test baseline.plaintext
test("baseline.plaintext: the string goes out as text/plain", async () => {
  const response = await request(app).get("/plaintext");

  assert.equal(response.status, 200);
  assert.equal(response.text, "Hello, World!");
  assert.match(response.headers["content-type"]!, /^text\/plain/);
});

test("no answer says it came from Express", async () => {
  const response = await request(app).get("/plaintext");

  assert.equal(response.headers["x-powered-by"], undefined);
});
