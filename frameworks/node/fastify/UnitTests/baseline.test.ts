import assert from "node:assert/strict";
import { test } from "node:test";

import { app } from "./app.ts";

// rb:test baseline.plaintext
test("baseline.plaintext: a string goes out as text/plain", async () => {
  const response = await app.inject({ method: "GET", url: "/plaintext" });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body, "Hello, World!");
  assert.match(response.headers["content-type"] as string, /^text\/plain/);
});
