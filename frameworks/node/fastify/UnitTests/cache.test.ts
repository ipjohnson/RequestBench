import assert from "node:assert/strict";
import { test } from "node:test";

import { app, expected } from "./app.ts";

async function serial(url: string, headers: Record<string, string> = {}): Promise<string | undefined> {
  const response = await app.inject({ method: "GET", url, headers });
  return response.headers["x-rb-serial"] as string | undefined;
}

// rb:test cache.small,cache.medium,cache.large
for (const [id, size] of [["cache.small", "small"], ["cache.medium", "medium"], ["cache.large", "large"]] as const) {
  test(`${id}: a second request is the stored answer`, async () => {
    const first = await app.inject({ method: "GET", url: `/cache/${size}` });
    const second = await app.inject({ method: "GET", url: `/cache/${size}` });

    assert.deepEqual(second.json(), expected.json(`items.${size}.json`));
    assert.equal(second.headers["x-rb-serial"], first.headers["x-rb-serial"]);
    assert.match(second.headers["content-type"] as string, /^application\/json/);
  });
}

// rb:test cache.vary_one
test("cache.vary_one: one vary header keys the store", async () => {
  const alpha = await serial("/cache/vary/one", { "x-rb-tenant": "alpha" });
  const beta = await serial("/cache/vary/one", { "x-rb-tenant": "beta" });

  assert.equal(await serial("/cache/vary/one", { "x-rb-tenant": "alpha" }), alpha);
  assert.notEqual(alpha, beta);
});

// rb:test cache.vary_many
test("cache.vary_many: each of three vary headers keys the store", async () => {
  const webEuAlpha = { "x-rb-channel": "web", "x-rb-region": "eu", "x-rb-tenant": "alpha" };

  const first = await serial("/cache/vary/many", webEuAlpha);

  assert.equal(await serial("/cache/vary/many", webEuAlpha), first);
  assert.notEqual(await serial("/cache/vary/many", { ...webEuAlpha, "x-rb-tenant": "beta" }), first);
  assert.notEqual(await serial("/cache/vary/many", { ...webEuAlpha, "x-rb-region": "us" }), first);
});

test("the answer says what it varies on", async () => {
  const response = await app.inject({ method: "GET", url: "/cache/vary/many" });

  assert.equal(response.headers["vary"], "x-rb-channel, x-rb-region, x-rb-tenant");
});

test("a route outside the family is never stored", async () => {
  const first = await app.inject({ method: "GET", url: "/compressed/small" });
  const second = await app.inject({ method: "GET", url: "/compressed/small" });

  assert.notEqual(second.headers["x-rb-serial"], first.headers["x-rb-serial"]);
});
