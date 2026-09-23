import assert from "node:assert/strict";
import { test } from "node:test";

import { bytes, client, expected } from "./app.ts";

// rb:test static.file
test("static.file: the committed file is served byte for byte", async () => {
  const file = expected.bytes("items.large.json");

  const response = await client.get("/static/items.large.json").set("accept-encoding", "identity").buffer(true).parse(bytes);

  assert.equal(response.status, 200);
  assert.match(response.headers["content-type"]!, /^application\/json/);
  assert.equal(response.headers["content-length"], String(file.length));
  assert.notEqual(response.headers["last-modified"], undefined);
  assert.deepEqual(response.body, file);
});
