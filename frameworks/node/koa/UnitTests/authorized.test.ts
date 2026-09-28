import assert from "node:assert/strict";
import { test } from "node:test";

import { client, expected } from "./app.ts";

// rb:test authorized.allowed
test("authorized.allowed: the accepted token reaches the handler", async () => {
  const response = await client.get("/authorized/small").set("authorization", `Bearer 5a7cc77ed0dcb825806b6f872026c317`);

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, expected.json("items.small.json"));
});

// rb:test authorized.denied
test("authorized.denied: a token one character off is Koa's 403", async () => {
  const response = await client.get("/authorized/small").set("authorization", `Bearer 5a7cc77ed0dcb825806b6f872026c310`);

  assert.equal(response.status, 403);
  assert.match(response.headers["content-type"]!, /^text\/plain/);
  assert.equal(response.text, "Forbidden");
});

test("no token is refused the same way", async () => {
  const response = await client.get("/authorized/small");

  assert.equal(response.status, 403);
});
