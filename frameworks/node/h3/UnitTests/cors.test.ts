import assert from "node:assert/strict";
import { test } from "node:test";

import { app, expected } from "./app.ts";

const allowedOrigin = "https://shop.example.com";

const preflight = (url: string, origin: string) =>
  app.request(url, {
    method: "OPTIONS",
    headers: { origin, "access-control-request-method": "GET", "access-control-request-headers": "x-rb-tenant" },
  });

// rb:test cors.preflight
test("cors.preflight: handleCors answers a preflight before the handler writes anything", async () => {
  const response = await preflight("/cors/small", allowedOrigin);

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), allowedOrigin);
  assert.equal(response.headers.get("access-control-allow-headers"), "x-rb-tenant");
  assert.equal(response.headers.get("access-control-max-age"), "600");
  assert.equal(response.headers.get("x-rb-serial"), null);
});

// rb:test cors.disallowed
test("cors.disallowed: a preflight from another origin is not allowed", async () => {
  const response = await preflight("/cors/small", "https://elsewhere.example.net");

  assert.equal(response.headers.get("access-control-allow-origin"), null);
});

// rb:test cors.request,cors.vary
test("cors.request and cors.vary: the request reaches the handler and varies on origin", async () => {
  const response = await app.request("/cors/small", { headers: { origin: allowedOrigin, "x-rb-tenant": "qwertyuiopas" } });

  assert.deepEqual(await response.json(), expected.json("items.small.json"));
  assert.equal(response.headers.get("access-control-allow-origin"), allowedOrigin);
  assert.equal(response.headers.get("vary"), "origin");
  assert.notEqual(response.headers.get("x-rb-serial"), null);
});

// rb:test cors.scoped
test("cors.scoped: a route outside /cors gets no policy, and no preflight answer", async () => {
  const response = await app.request("/json/small", { headers: { origin: allowedOrigin } });

  assert.equal(response.headers.get("access-control-allow-origin"), null);
  assert.equal((await preflight("/json/small", allowedOrigin)).status, 404);
});
