import assert from "node:assert/strict";
import { test } from "node:test";

import { bytes, client, expected } from "./app.ts";

// rb:test stream.ndjson
test("stream.ndjson: each row of items.medium is a line, with no length", async () => {
  const response = await client.get("/stream/items").buffer(true).parse(bytes);

  assert.equal(response.status, 200);
  assert.match(response.headers["content-type"]!, /^application\/x-ndjson/);
  assert.equal(response.headers["content-length"], undefined);
  assert.deepEqual(
    (response.body as Buffer).toString("utf8").trimEnd().split("\n").map((line) => JSON.parse(line)),
    expected.json("items.medium.json").items,
  );
});
