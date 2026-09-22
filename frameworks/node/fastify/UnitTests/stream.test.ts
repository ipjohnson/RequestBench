import assert from "node:assert/strict";
import { test } from "node:test";

import { app, expected } from "./app.ts";

// rb:test stream.ndjson
test("stream.ndjson: each row of items.medium is a line, with no length", async () => {
  const response = await app.inject({ method: "GET", url: "/stream/items" });

  assert.equal(response.statusCode, 200);
  assert.match(response.headers["content-type"] as string, /^application\/x-ndjson/);
  assert.equal(response.headers["content-length"], undefined);
  assert.deepEqual(
    response.body.trimEnd().split("\n").map((line) => JSON.parse(line)),
    expected.json("items.medium.json").items,
  );
});
