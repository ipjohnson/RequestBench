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

test("a file that is not there is 404, and a path that climbs out is refused", async () => {
  assert.equal((await app.request("/static/nothing.json")).status, 404);
  assert.equal((await app.request("/static/%2e%2e/package.json")).status, 404);
});
