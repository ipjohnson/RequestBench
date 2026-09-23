import assert from "node:assert/strict";
import { test } from "node:test";

import { client, expected } from "./app.ts";

const get = (size: string, encoding: string) => client.get(`/compressed/${size}`).set({ "accept-encoding": encoding, "cache-control": "no-cache" });

// superagent unzips a gzipped answer before it is read, so the encoding is read off the header.

// rb:test compressed.gzip_large
test("compressed.gzip_large: a large body is gzipped when asked", async () => {
  const response = await get("large", "gzip");

  assert.equal(response.headers["content-encoding"], "gzip");
  assert.deepEqual(response.body, expected.json("items.large.json"));
});

// rb:test compressed.gzip_small
test("compressed.gzip_small: a body under the threshold goes out as it is", async () => {
  const response = await get("small", "gzip");

  assert.equal(response.headers["content-encoding"], undefined);
  assert.deepEqual(response.body, expected.json("items.small.json"));
});

// rb:test compressed.identity_small,compressed.identity_large
for (const [id, size] of [["compressed.identity_small", "small"], ["compressed.identity_large", "large"]] as const) {
  test(`${id}: identity is answered as it is, and the handler runs every time`, async () => {
    const first = await get(size, "identity");
    const second = await get(size, "identity");

    assert.equal(second.headers["content-encoding"], undefined);
    assert.deepEqual(second.body, expected.json(`items.${size}.json`));
    assert.ok(Number(second.headers["x-rb-serial"]) > Number(first.headers["x-rb-serial"]));
  });
}

test("a route outside the family is not compressed", async () => {
  const response = await client.get("/json/large").set("accept-encoding", "gzip");

  assert.equal(response.headers["content-encoding"], undefined);
});
