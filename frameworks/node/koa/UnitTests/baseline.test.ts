import assert from "node:assert/strict";
import { test } from "node:test";

import { client } from "./app.ts";

// rb:test baseline.plaintext
test("baseline.plaintext: a string goes out as text/plain", async () => {
  const response = await client.get("/plaintext");

  assert.equal(response.status, 200);
  assert.equal(response.text, "Hello, World!");
  assert.match(response.headers["content-type"]!, /^text\/plain/);
});
