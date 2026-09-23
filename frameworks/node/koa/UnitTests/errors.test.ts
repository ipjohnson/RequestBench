import assert from "node:assert/strict";
import { test } from "node:test";

import { client } from "./app.ts";

/**
 * errors: every refusal here is Koa's own error handling or @koa/router's, which write the status
 * message as text. Nothing reshapes any of them.
 */

// rb:test errors.unmatched
test("errors.unmatched: a path no route matches is Koa's 404", async () => {
  const response = await client.get("/errors/unmatched");

  assert.equal(response.status, 404);
  assert.match(response.headers["content-type"]!, /^text\/plain/);
  assert.equal(response.text, "Not Found");
});

// rb:test errors.not_found
test("errors.not_found: an id with no row is ctx.throw's 404", async () => {
  const response = await client.get("/items/999999");

  assert.equal(response.status, 404);
  assert.equal(response.text, "Not Found");
});

// rb:test errors.wrong_method
test("errors.wrong_method: a method the path has no route for is the router's 405, with Allow", async () => {
  const response = await client.post("/items/17");

  assert.equal(response.status, 405);
  assert.equal(response.headers["allow"], "HEAD, GET, PUT, PATCH, DELETE");
  assert.equal(response.text, "Method Not Allowed");
});

// rb:test errors.malformed
test("errors.malformed: a body that is not JSON is the body parser's 400", async () => {
  const response = await client.post("/body/validate/small").set("content-type", "application/json").send('{"customerId": 1, "lines": [');

  assert.equal(response.status, 400);
  assert.equal(response.text, "Bad Request");
});
