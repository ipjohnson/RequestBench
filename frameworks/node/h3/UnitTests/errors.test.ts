import assert from "node:assert/strict";
import { test } from "node:test";

import { app } from "./app.ts";

/**
 * errors: every refusal is h3's own error JSON, written by its error handling for the router's miss,
 * for readBody's failure and for the HTTPError the items handlers throw. Nothing here reshapes any
 * of them.
 */

// rb:test errors.unmatched
test("errors.unmatched: a path no route matches is the router's 404, naming the request's URL", async () => {
  const response = await app.request("/errors/unmatched");

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { status: 404, message: "Cannot find any route matching [GET] http://localhost/errors/unmatched" });
});

// rb:test errors.not_found
test("errors.not_found: an id with no row is the handler's HTTPError 404", async () => {
  const response = await app.request("/items/999999");

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { status: 404, statusText: "Not Found", message: "Not Found" });
});

// rb:test errors.wrong_method
test("errors.wrong_method: a method the path has no route for is 404, as a path with no route is", async () => {
  const response = await app.request("/items/17", { method: "POST" });

  assert.equal(response.status, 404);
  assert.equal(((await response.json()) as { message: string }).message, "Cannot find any route matching [POST] http://localhost/items/17");
});

// rb:test errors.malformed
test("errors.malformed: a body that is not JSON is readBody's 400, before any schema runs", async () => {
  const response = await app.request("/body/validate/small", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: '{"customerId": 1, "lines": [',
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { status: 400, statusText: "Bad Request", message: "Invalid JSON body" });
});
