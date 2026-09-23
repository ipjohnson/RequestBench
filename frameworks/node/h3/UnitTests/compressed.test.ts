import assert from "node:assert/strict";
import { test } from "node:test";
import { gunzipSync } from "node:zlib";

import { app, expected } from "./app.ts";

const get = (size: string, encoding: string) =>
  app.request(`/compressed/${size}`, { headers: { "accept-encoding": encoding, "cache-control": "no-cache" } });

// rb:test compressed.gzip_large
test("compressed.gzip_large: a large body is gzipped when asked", async () => {
  const response = await get("large", "gzip");

  assert.equal(response.headers.get("content-encoding"), "gzip");
  assert.equal(response.headers.get("vary"), "accept-encoding");
  const body = gunzipSync(Buffer.from(await response.arrayBuffer()));
  assert.deepEqual(JSON.parse(body.toString("utf8")), expected.json("items.large.json"));
});

// rb:test compressed.gzip_small
test("compressed.gzip_small: a body under the threshold goes out as it is", async () => {
  const response = await get("small", "gzip");

  assert.equal(response.headers.get("content-encoding"), null);
  assert.deepEqual(await response.json(), expected.json("items.small.json"));
});

// rb:test compressed.identity_small,compressed.identity_large
for (const [id, size] of [["compressed.identity_small", "small"], ["compressed.identity_large", "large"]] as const) {
  test(`${id}: identity is answered as it is, and the handler runs every time`, async () => {
    const first = await get(size, "identity");
    const second = await get(size, "identity");

    assert.equal(second.headers.get("content-encoding"), null);
    assert.deepEqual(await second.json(), expected.json(`items.${size}.json`));
    assert.ok(Number(second.headers.get("x-rb-serial")) > Number(first.headers.get("x-rb-serial")));
  });
}

test("a route outside the family is not compressed", async () => {
  const response = await app.request("/json/large", { headers: { "accept-encoding": "gzip" } });

  assert.equal(response.headers.get("content-encoding"), null);
});
