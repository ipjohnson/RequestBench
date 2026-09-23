import assert from "node:assert/strict";
import { test } from "node:test";

import request from "supertest";

import { app, expected } from "./app.ts";

const get = (size: string, headers: Record<string, string> = {}) => request(app).get(`/etag/${size}`).set(headers);

// rb:test etag.small,etag.large
for (const [id, size] of [["etag.small", "small"], ["etag.large", "large"]] as const) {
  test(`${id}: the answer carries the weak tag Express computed`, async () => {
    const response = await get(size);

    assert.equal(response.status, 200);
    assert.match(response.headers["etag"]!, /^W\/"[0-9a-f]+-[A-Za-z0-9+/]{27}"$/);
    assert.deepEqual(response.body, expected.json(`items.${size}.json`));
  });
}

// rb:test etag.match_large
test("etag.match_large: a matching If-None-Match is answered 304 with no body, after the handler ran", async () => {
  const first = await get("large");

  const response = await get("large", { "if-none-match": first.headers["etag"]! });

  assert.equal(response.status, 304);
  assert.equal(response.text, "");
  assert.ok(Number(response.headers["x-rb-serial"]) > Number(first.headers["x-rb-serial"]));
});

// rb:test etag.stale_large
test("etag.stale_large: a tag that does not match is answered in full", async () => {
  const { staleEtag } = expected.json("settings.json") as { staleEtag: string };

  const response = await get("large", { "if-none-match": staleEtag });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, expected.json("items.large.json"));
});

test("the sub-application turns x-powered-by off as the application does", async () => {
  const response = await get("small");

  assert.equal(response.headers["x-powered-by"], undefined);
});
