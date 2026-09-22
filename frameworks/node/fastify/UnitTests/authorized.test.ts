import assert from "node:assert/strict";
import { test } from "node:test";

import { app, expected } from "./app.ts";

const settings = expected.json("settings.json") as { token: string; wrongToken: string };

// rb:test authorized.allowed
test("authorized.allowed: the accepted token reaches the handler", async () => {
  const response = await app.inject({ method: "GET", url: "/authorized/small", headers: { authorization: `Bearer ${settings.token}` } });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), expected.json("items.small.json"));
});

// rb:test authorized.denied
test("authorized.denied: a token one character off is refused with 403", async () => {
  const response = await app.inject({ method: "GET", url: "/authorized/small", headers: { authorization: `Bearer ${settings.wrongToken}` } });

  assert.equal(response.statusCode, 403);
  assert.deepEqual(response.json(), { statusCode: 403, error: "Forbidden", message: "Forbidden" });
});

test("no token is refused the same way", async () => {
  const response = await app.inject({ method: "GET", url: "/authorized/small" });

  assert.equal(response.statusCode, 403);
});
