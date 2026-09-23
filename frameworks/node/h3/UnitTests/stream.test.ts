import assert from "node:assert/strict";
import { test } from "node:test";

import { app, expected } from "./app.ts";

// rb:test stream.ndjson
test("stream.ndjson: each row of items.medium is a line, with no length", async () => {
  const response = await app.request("/stream/items");

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type")!, /^application\/x-ndjson/);
  assert.equal(response.headers.get("content-length"), null);
  assert.deepEqual(
    (await response.text()).trimEnd().split("\n").map((line) => JSON.parse(line)),
    expected.json("items.medium.json").items,
  );
});
