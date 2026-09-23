import assert from "node:assert/strict";
import { test } from "node:test";

import { app, expected } from "./app.ts";

const settings = expected.json("settings.json") as { token: string; wrongToken: string };

// rb:test authorized.allowed
test("authorized.allowed: the accepted token reaches the handler", async () => {
  const response = await app.request("/authorized/small", { headers: { authorization: `Bearer ${settings.token}` } });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), expected.json("items.small.json"));
});

// rb:test authorized.denied
test("authorized.denied: a token one character off is refused with 403 by an HTTPException", async () => {
  const response = await app.request("/authorized/small", { headers: { authorization: `Bearer ${settings.wrongToken}` } });

  assert.equal(response.status, 403);
  assert.match(response.headers.get("content-type")!, /^text\/plain/);
  assert.equal(await response.text(), "Forbidden");
});

test("no token is refused the same way", async () => {
  const response = await app.request("/authorized/small");

  assert.equal(response.status, 403);
});
