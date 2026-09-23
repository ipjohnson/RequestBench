import assert from "node:assert/strict";
import { test } from "node:test";

import { client, expected, run } from "./app.ts";

const { cors } = expected.json("settings.json") as { cors: { origin: string; method: string; header: string; maxAgeSeconds: number } };

const preflight = (url: string, origin: string) =>
  client.options(url).set({ origin, "access-control-request-method": cors.method, "access-control-request-headers": cors.header });

// rb:test cors.preflight
test("cors.preflight: @koa/cors answers a preflight before any handler", async () => {
  const response = await preflight("/cors/small", cors.origin);

  assert.equal(response.status, 204);
  assert.equal(response.headers["access-control-allow-origin"], cors.origin);
  assert.equal(response.headers["access-control-allow-headers"], cors.header);
  assert.equal(response.headers["access-control-max-age"], String(cors.maxAgeSeconds));
  assert.equal(response.headers["x-rb-serial"], undefined);
});

// rb:test cors.disallowed
test("cors.disallowed: a preflight from another origin is not allowed", async () => {
  const response = await preflight("/cors/small", "https://elsewhere.example.net");

  assert.equal(response.headers["access-control-allow-origin"], undefined);
});

// rb:test cors.request,cors.vary
test("cors.request and cors.vary: the request reaches the handler and varies on origin", async () => {
  const response = await client.get("/cors/small").set({ origin: cors.origin, [cors.header]: run.tenant });

  assert.deepEqual(response.body, expected.json("items.small.json"));
  assert.equal(response.headers["access-control-allow-origin"], cors.origin);
  assert.equal(response.headers["vary"], "Origin");
  assert.notEqual(response.headers["x-rb-serial"], undefined);
});

// rb:test cors.scoped
test("cors.scoped: a route outside /cors gets no policy, and its preflight is only the router's Allow", async () => {
  const response = await client.get("/json/small").set("origin", cors.origin);
  const options = await preflight("/json/small", cors.origin);

  assert.equal(response.headers["access-control-allow-origin"], undefined);
  assert.equal(options.status, 200);
  assert.equal(options.headers["allow"], "HEAD, GET");
  assert.equal(options.headers["access-control-allow-origin"], undefined);
});
