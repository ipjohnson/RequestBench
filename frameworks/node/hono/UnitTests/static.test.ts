import assert from "node:assert/strict";
import { test } from "node:test";

import { app, expected } from "./app.ts";

// rb:test static.file
test("static.file: the committed file is served byte for byte", async () => {
  const file = expected.bytes("items.large.json");

  const response = await app.request("/static/items.large.json");

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type")!, /^application\/json/);
  assert.equal(response.headers.get("content-length"), String(file.length));
  assert.notEqual(response.headers.get("last-modified"), null);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), file);
});

test("a file the directory does not hold is the not-found handler's 404", async () => {
  const response = await app.request("/static/nothing.json");

  assert.equal(response.status, 404);
});
