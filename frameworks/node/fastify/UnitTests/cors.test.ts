import assert from "node:assert/strict";
import { test } from "node:test";

import { app, expected } from "./app.ts";

const allowedOrigin = "https://shop.example.com";

const preflight = (url: string, origin: string) =>
  app.inject({
    method: "OPTIONS",
    url,
    headers: { origin, "access-control-request-method": "GET", "access-control-request-headers": "x-rb-tenant" },
  });

// rb:test cors.preflight
test("cors.preflight: the plugin answers a preflight before any handler", async () => {
  const response = await preflight("/cors/small", allowedOrigin);

  assert.equal(response.statusCode, 204);
  assert.equal(response.headers["access-control-allow-origin"], allowedOrigin);
  assert.equal(response.headers["access-control-allow-headers"], "x-rb-tenant");
  assert.equal(response.headers["access-control-max-age"], "600");
  assert.equal(response.headers["x-rb-serial"], undefined);
});

// rb:test cors.disallowed
test("cors.disallowed: a preflight from another origin is not allowed", async () => {
  const response = await preflight("/cors/small", "https://elsewhere.example.net");

  assert.equal(response.headers["access-control-allow-origin"], undefined);
});

// rb:test cors.request,cors.vary
test("cors.request and cors.vary: the request reaches the handler and varies on origin", async () => {
  const response = await app.inject({ method: "GET", url: "/cors/small", headers: { origin: allowedOrigin, "x-rb-tenant": "qwertyuiopas" } });

  assert.deepEqual(response.json(), expected.json("items.small.json"));
  assert.equal(response.headers["access-control-allow-origin"], allowedOrigin);
  assert.equal(response.headers["vary"], "Origin");
  assert.notEqual(response.headers["x-rb-serial"], undefined);
});

// rb:test cors.scoped
test("cors.scoped: a route outside /cors gets no policy, and no preflight answer", async () => {
  const response = await app.inject({ method: "GET", url: "/json/small", headers: { origin: allowedOrigin } });

  assert.equal(response.headers["access-control-allow-origin"], undefined);
  assert.equal((await preflight("/json/small", allowedOrigin)).statusCode, 404);
});
