import assert from "node:assert/strict";
import { test } from "node:test";

import { app, expected } from "./app.ts";

// rb:test authorized.allowed
test("authorized.allowed: the accepted token reaches the handler", async () => {
  const response = await app.request("/authorized/small", { headers: { authorization: `Bearer 5a7cc77ed0dcb825806b6f872026c317` } });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), expected.json("items.small.json"));
});

// rb:test authorized.denied
test("authorized.denied: a token one character off is refused with h3's 403", async () => {
  const response = await app.request("/authorized/small", { headers: { authorization: `Bearer 5a7cc77ed0dcb825806b6f872026c310` } });

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { status: 403, statusText: "Forbidden", message: "Forbidden" });
});

test("no token is refused the same way", async () => {
  const response = await app.request("/authorized/small");

  assert.equal(response.status, 403);
});
