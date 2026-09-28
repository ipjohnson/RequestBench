import assert from "node:assert/strict";
import { test } from "node:test";

import { app, expected } from "./app.ts";

/** x-rb-serial, after checking it starts with the Unix time in milliseconds it was written at. */
async function serial(url: string, headers: Record<string, string> = {}): Promise<string> {
  const response = await app.request(url, { headers });
  const value = String(response.headers.get("x-rb-serial"));
  const form = /^(\d+)\|\d+$/.exec(value);
  assert.ok(form, `x-rb-serial ${value} is not <time stamp>|<count>`);
  const age = Date.now() - Number(form[1]);
  assert.ok(age >= 0 && age < 60_000, `x-rb-serial ${value} was written ${age} ms ago`);
  return value;
}

// rb:test cache.small,cache.medium,cache.large
for (const [id, size] of [["cache.small", "small"], ["cache.medium", "medium"], ["cache.large", "large"]] as const) {
  test(`${id}: a second request for a key is its stored answer`, async () => {
    const first = await app.request(`/cache/${size}/k1`);
    const second = await app.request(`/cache/${size}/k1`);

    assert.deepEqual(await second.json(), expected.json(`items.${size}.json`));
    assert.equal(second.headers.get("x-rb-serial"), first.headers.get("x-rb-serial"));
    assert.notEqual(await serial(`/cache/${size}/k2`), first.headers.get("x-rb-serial"));
    assert.equal(second.headers.get("x-cache"), "HIT");
    assert.match(second.headers.get("content-type")!, /^application\/json/);
  });
}

// rb:test cache.vary_one
test("cache.vary_one: one vary header keys the store", async () => {
  const alpha = await serial("/cache/vary/one/k1", { "x-rb-tenant": "alpha" });
  const beta = await serial("/cache/vary/one/k1", { "x-rb-tenant": "beta" });

  assert.equal(await serial("/cache/vary/one/k1", { "x-rb-tenant": "alpha" }), alpha);
  assert.notEqual(alpha, beta);
});

// rb:test cache.vary_many
test("cache.vary_many: each of three vary headers keys the store", async () => {
  const webEuAlpha = { "x-rb-channel": "web", "x-rb-region": "eu", "x-rb-tenant": "alpha" };

  const first = await serial("/cache/vary/many/k1", webEuAlpha);

  assert.equal(await serial("/cache/vary/many/k1", webEuAlpha), first);
  assert.notEqual(await serial("/cache/vary/many/k1", { ...webEuAlpha, "x-rb-tenant": "beta" }), first);
  assert.notEqual(await serial("/cache/vary/many/k1", { ...webEuAlpha, "x-rb-region": "us" }), first);
});

test("the answer says what it varies on", async () => {
  const response = await app.request("/cache/vary/many/k1");

  assert.equal(response.headers.get("vary"), "x-rb-channel, x-rb-region, x-rb-tenant");
});

test("a route outside the family is never stored", async () => {
  const first = await serial("/compressed/small");
  const second = await serial("/compressed/small");

  assert.notEqual(second, first);
});
