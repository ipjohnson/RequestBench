import assert from "node:assert/strict";
import { test } from "node:test";

import request from "supertest";

import { app, asText, expected } from "./app.ts";

// rb:test stream.ndjson
test("stream.ndjson: each row of items.medium is a line, with no length", async () => {
  const response = await asText(request(app).get("/stream/items"));

  assert.equal(response.status, 200);
  assert.match(response.headers["content-type"]!, /^application\/x-ndjson/);
  assert.equal(response.headers["content-length"], undefined);
  assert.deepEqual(
    (response.body as string).trimEnd().split("\n").map((line) => JSON.parse(line)),
    expected.json("items.medium.json").items,
  );
});
