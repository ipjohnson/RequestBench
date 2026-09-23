import assert from "node:assert/strict";
import { test } from "node:test";

import { app, postJson } from "./app.ts";

/**
 * errors: every refusal is Hono's own, written by its default not-found handler or its default
 * error handler. Nothing here reshapes any of them.
 */

// rb:test errors.unmatched
test("errors.unmatched: a path no route matches is the not-found handler's 404", async () => {
  const response = await app.request("/errors/unmatched");

  assert.equal(response.status, 404);
  assert.match(response.headers.get("content-type")!, /^text\/plain/);
  assert.equal(await response.text(), "404 Not Found");
});

// rb:test errors.not_found
test("errors.not_found: an id with no row is c.notFound(), the same 404", async () => {
  const response = await app.request("/items/999999");

  assert.equal(response.status, 404);
  assert.equal(await response.text(), "404 Not Found");
});

// rb:test errors.wrong_method
test("errors.wrong_method: a method the path has no route for is 404, as a path with no route is", async () => {
  const response = await app.request("/items/17", { method: "POST" });

  assert.equal(response.status, 404);
  assert.equal(await response.text(), "404 Not Found");
});

// rb:test errors.malformed
test("errors.malformed: a body that is not JSON is the validator's 400, before zod runs", async () => {
  const response = await postJson("/body/validate/small", '{"customerId": 1, "lines": [');

  assert.equal(response.status, 400);
  assert.match(response.headers.get("content-type")!, /^text\/plain/);
  assert.equal(await response.text(), "Malformed JSON in request body");
});
