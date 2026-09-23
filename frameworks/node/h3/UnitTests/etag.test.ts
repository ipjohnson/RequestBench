import assert from "node:assert/strict";
import { test } from "node:test";

import { app, expected } from "./app.ts";

const get = (size: string, headers: Record<string, string> = {}) => app.request(`/etag/${size}`, { headers });

// rb:test etag.small,etag.large
for (const [id, size] of [["etag.small", "small"], ["etag.large", "large"]] as const) {
  test(`${id}: the answer carries the tag its body hashes to`, async () => {
    const response = await get(size);

    assert.equal(response.status, 200);
    assert.match(response.headers.get("etag")!, /^"[^"]+"$/);
    assert.deepEqual(await response.json(), expected.json(`items.${size}.json`));
  });
}

// rb:test etag.match_large
test("etag.match_large: a matching If-None-Match is answered 304 with no body, after the handler ran", async () => {
  const first = await get("large");

  const response = await get("large", { "if-none-match": first.headers.get("etag")! });

  assert.equal(response.status, 304);
  assert.equal((await response.arrayBuffer()).byteLength, 0);
  assert.ok(Number(response.headers.get("x-rb-serial")) > Number(first.headers.get("x-rb-serial")));
});

// rb:test etag.stale_large
test("etag.stale_large: a tag that does not match is answered in full", async () => {
  const { staleEtag } = expected.json("settings.json") as { staleEtag: string };

  const response = await get("large", { "if-none-match": staleEtag });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), expected.json("items.large.json"));
});

test("a route outside the family carries no tag", async () => {
  const response = await app.request("/json/small");

  assert.equal(response.headers.get("etag"), null);
});
