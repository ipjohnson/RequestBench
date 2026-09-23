import assert from "node:assert/strict";
import { mock, test } from "node:test";

import request from "supertest";

import { app } from "./app.ts";

/**
 * errors: every refusal is Express's own. The router's misses and the parser's error reach Express's
 * final handler, which writes an HTML page naming the miss or the status, and the items handlers
 * refuse a missing row with res.sendStatus(404). Nothing here reshapes any of them.
 */

/** The page Express's final handler writes when NODE_ENV is production. */
const page = (message: string) =>
  `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Error</title>\n</head>\n<body>\n<pre>${message}</pre>\n</body>\n</html>\n`;

// rb:test errors.unmatched
test("errors.unmatched: a path no route matches is the final handler's 404 page", async () => {
  const response = await request(app).get("/errors/unmatched");

  assert.equal(response.status, 404);
  assert.match(response.headers["content-type"]!, /^text\/html/);
  assert.equal(response.text, page("Cannot GET /errors/unmatched"));
});

// rb:test errors.not_found
test("errors.not_found: an id with no row is the handler's res.sendStatus(404)", async () => {
  const response = await request(app).get("/items/999999");

  assert.equal(response.status, 404);
  assert.match(response.headers["content-type"]!, /^text\/plain/);
  assert.equal(response.text, "Not Found");
});

// rb:test errors.wrong_method
test("errors.wrong_method: a method the path has no route for is 404, as a path with no route is", async () => {
  const response = await request(app).post("/items/17");

  assert.equal(response.status, 404);
  assert.equal(response.text, page("Cannot POST /items/17"));
});

// rb:test errors.malformed
test("errors.malformed: a body that is not JSON is the parser's 400, which the final handler writes and logs", async (t) => {
  const logged = mock.method(console, "error", () => {});
  t.after(() => logged.mock.restore());

  const response = await request(app)
    .post("/body/validate/small")
    .set("content-type", "application/json")
    .send('{"customerId": 1, "lines": [');

  assert.equal(response.status, 400);
  assert.equal(response.text, page("Bad Request"));
  assert.equal(logged.mock.callCount(), 1);
  assert.match(String(logged.mock.calls[0]!.arguments[0]), /^SyntaxError/);
});
