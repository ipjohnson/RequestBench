import assert from "node:assert/strict";
import { test } from "node:test";

import request from "supertest";

import { app, expected } from "./app.ts";

const settings = expected.json("settings.json") as { token: string; wrongToken: string };

// rb:test authorized.allowed
test("authorized.allowed: the accepted token reaches the handler", async () => {
  const response = await request(app).get("/authorized/small").set("authorization", `Bearer ${settings.token}`);

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, expected.json("items.small.json"));
});

// rb:test authorized.denied
test("authorized.denied: a token one character off is refused with res.sendStatus's 403", async () => {
  const response = await request(app).get("/authorized/small").set("authorization", `Bearer ${settings.wrongToken}`);

  assert.equal(response.status, 403);
  assert.match(response.headers["content-type"]!, /^text\/plain/);
  assert.equal(response.text, "Forbidden");
});

test("no token is refused the same way", async () => {
  const response = await request(app).get("/authorized/small");

  assert.equal(response.status, 403);
});
