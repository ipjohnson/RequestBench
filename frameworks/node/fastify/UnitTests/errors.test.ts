import assert from "node:assert/strict";
import { test } from "node:test";

import { app } from "./app.ts";

/**
 * errors: every refusal is Fastify's own, written by its default error handler or its default
 * not-found handler. Nothing here reshapes any of them.
 */

// rb:test errors.unmatched
test("errors.unmatched: a path no route matches is the router's 404", async () => {
  const response = await app.inject({ method: "GET", url: "/errors/unmatched" });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), { message: "Route GET:/errors/unmatched not found", error: "Not Found", statusCode: 404 });
});

// rb:test errors.not_found
test("errors.not_found: an id with no row is the handler's 404", async () => {
  const response = await app.inject({ method: "GET", url: "/items/999999" });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), { statusCode: 404, error: "Not Found", message: "Not Found" });
});

// rb:test errors.wrong_method
test("errors.wrong_method: a method the path has no route for is 404, as a path with no route is", async () => {
  const response = await app.inject({ method: "POST", url: "/items/17" });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().message, "Route POST:/items/17 not found");
});

// rb:test errors.malformed
test("errors.malformed: a body that is not JSON is the parser's 400, and closes the connection", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/body/validate/small",
    headers: { "content-type": "application/json" },
    payload: '{"customerId": 1, "lines": [',
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().code, "FST_ERR_CTP_INVALID_JSON_BODY");
  assert.equal(response.headers["connection"], "close");
});
