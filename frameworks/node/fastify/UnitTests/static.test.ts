import assert from "node:assert/strict";
import { test } from "node:test";

import { app, expected } from "./app.ts";

// rb:test static.file
test("static.file: the committed file is served byte for byte", async () => {
  const file = expected.bytes("items.large.json");

  const response = await app.inject({ method: "GET", url: "/static/items.large.json" });

  assert.equal(response.statusCode, 200);
  assert.match(response.headers["content-type"] as string, /^application\/json/);
  assert.equal(response.headers["content-length"], String(file.length));
  assert.notEqual(response.headers["last-modified"], undefined);
  assert.deepEqual(response.rawPayload, file);
});
