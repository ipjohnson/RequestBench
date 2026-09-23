import assert from "node:assert/strict";
import { test } from "node:test";

import request from "supertest";

import { app, expected, run } from "./app.ts";

// rb:test parameters.static
test("parameters.static: the static route, registered first, wins over the capture that also matches it", async () => {
  const response = await request(app).get("/parameters/static/segment/literal");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, expected.json("items.small.json"));
});

// rb:test parameters.one
test("parameters.one: the capture is echoed as an integer", async () => {
  const response = await request(app).get(`/parameters/${run.one}/segment/literal`);

  assert.deepEqual(response.body, expected.withEcho("items.small.json", { one: run.one }));
});

// rb:test parameters.two
test("parameters.two: both captures are echoed as integers", async () => {
  const response = await request(app).get(`/parameters/${run.one}/with-second/${run.two}`);

  assert.deepEqual(response.body, expected.withEcho("items.small.json", { one: run.one, two: run.two }));
});

test("nothing checks a capture, so one that is not a number is written back as null", async () => {
  const response = await request(app).get("/parameters/four/segment/literal");

  assert.equal(response.status, 200);
  assert.equal(response.body.echo.one, null);
});
