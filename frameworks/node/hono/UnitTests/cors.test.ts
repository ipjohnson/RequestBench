import assert from "node:assert/strict";
import { test } from "node:test";

import { app, expected } from "./app.ts";

const { cors } = expected.json("settings.json") as { cors: { origin: string; method: string; header: string; maxAgeSeconds: number } };

const preflight = (url: string, origin: string) =>
  app.request(url, {
    method: "OPTIONS",
    headers: { origin, "access-control-request-method": cors.method, "access-control-request-headers": cors.header },
  });

// rb:test cors.preflight
test("cors.preflight: the middleware answers a preflight before any handler", async () => {
  const response = await preflight("/cors/small", cors.origin);

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), cors.origin);
  assert.equal(response.headers.get("access-control-allow-headers"), cors.header);
  assert.equal(response.headers.get("access-control-max-age"), String(cors.maxAgeSeconds));
  assert.equal(response.headers.get("x-rb-serial"), null);
});

// rb:test cors.disallowed
test("cors.disallowed: a preflight from another origin is not allowed", async () => {
  const response = await preflight("/cors/small", "https://elsewhere.example.net");

  assert.equal(response.headers.get("access-control-allow-origin"), null);
});

// rb:test cors.request,cors.vary
test("cors.request and cors.vary: the request reaches the handler and varies on origin", async () => {
  const response = await app.request("/cors/small", { headers: { origin: cors.origin, [cors.header]: "qwertyuiopas" } });

  assert.deepEqual(await response.json(), expected.json("items.small.json"));
  assert.equal(response.headers.get("access-control-allow-origin"), cors.origin);
  assert.equal(response.headers.get("vary"), "Origin");
  assert.notEqual(response.headers.get("x-rb-serial"), null);
});

// rb:test cors.scoped
test("cors.scoped: a route outside /cors gets no policy, and no preflight answer", async () => {
  const response = await app.request("/json/small", { headers: { origin: cors.origin } });

  assert.equal(response.headers.get("access-control-allow-origin"), null);
  assert.equal((await preflight("/json/small", cors.origin)).status, 404);
});
