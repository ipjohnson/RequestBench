import assert from "node:assert/strict";
import { test } from "node:test";

import { app } from "./app.ts";

// rb:test baseline.plaintext
test("baseline.plaintext: a string goes out as text/plain", async () => {
  const response = await app.request("/plaintext");

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "Hello, World!");
  assert.match(response.headers.get("content-type")!, /^text\/plain/);
});
