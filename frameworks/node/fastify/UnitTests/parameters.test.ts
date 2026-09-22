import assert from "node:assert/strict";
import { test } from "node:test";

import { app, expected, run } from "./app.ts";

// rb:test parameters.static
test("parameters.static: the static route wins over the capture that also matches it", async () => {
  const response = await app.inject({ method: "GET", url: "/parameters/static/segment/literal" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), expected.json("items.small.json"));
});

// rb:test parameters.one
test("parameters.one: the capture is echoed as an integer", async () => {
  const response = await app.inject({ method: "GET", url: `/parameters/${run.one}/segment/literal` });

  assert.deepEqual(response.json(), expected.withEcho("items.small.json", { one: run.one }));
});

// rb:test parameters.two
test("parameters.two: both captures are echoed as integers", async () => {
  const response = await app.inject({ method: "GET", url: `/parameters/${run.one}/with-second/${run.two}` });

  assert.deepEqual(response.json(), expected.withEcho("items.small.json", { one: run.one, two: run.two }));
});

test("a capture that is not an integer is refused by the params schema", async () => {
  const response = await app.inject({ method: "GET", url: "/parameters/four/segment/literal" });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().code, "FST_ERR_VALIDATION");
});
