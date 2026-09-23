import assert from "node:assert/strict";
import { test } from "node:test";

import { client, expected, run } from "./app.ts";

// rb:test parameters.static
test("parameters.static: the static route answers before the capture that also matches it", async () => {
  const response = await client.get("/parameters/static/segment/literal");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, expected.json("items.small.json"));
});

// rb:test parameters.one
test("parameters.one: the capture is echoed as a number", async () => {
  const response = await client.get(`/parameters/${run.one}/segment/literal`);

  assert.deepEqual(response.body, expected.withEcho("items.small.json", { one: run.one }));
});

// rb:test parameters.two
test("parameters.two: both captures are echoed as numbers", async () => {
  const response = await client.get(`/parameters/${run.one}/with-second/${run.two}`);

  assert.deepEqual(response.body, expected.withEcho("items.small.json", { one: run.one, two: run.two }));
});
