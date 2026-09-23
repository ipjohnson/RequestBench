import assert from "node:assert/strict";
import { test } from "node:test";

import { bytes, client, expected } from "./app.ts";

const get = (size: string, headers: Record<string, string> = {}) => client.get(`/etag/${size}`).set(headers);

// rb:test etag.small,etag.large
for (const [id, size] of [["etag.small", "small"], ["etag.large", "large"]] as const) {
  test(`${id}: the answer carries the tag @koa/etag computed`, async () => {
    const response = await get(size);

    assert.equal(response.status, 200);
    assert.match(response.headers["etag"]!, /^"[^"]+"$/);
    assert.deepEqual(response.body, expected.json(`items.${size}.json`));
  });
}

// rb:test etag.match_large
test("etag.match_large: a matching If-None-Match is answered 304 with no body, after the handler ran", async () => {
  const first = await get("large");

  const response = await get("large", { "if-none-match": first.headers["etag"]! }).buffer(true).parse(bytes);

  assert.equal(response.status, 304);
  assert.equal((response.body as Buffer).length, 0);
  assert.ok(Number(response.headers["x-rb-serial"]) > Number(first.headers["x-rb-serial"]));
});

// rb:test etag.stale_large
test("etag.stale_large: a tag that does not match is answered in full", async () => {
  const { staleEtag } = expected.json("settings.json") as { staleEtag: string };

  const response = await get("large", { "if-none-match": staleEtag });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, expected.json("items.large.json"));
});

test("a route outside the family carries no tag", async () => {
  const response = await client.get("/json/small");

  assert.equal(response.headers["etag"], undefined);
});
