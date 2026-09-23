import assert from "node:assert/strict";
import { test } from "node:test";

import { app, expected, run } from "./app.ts";

// rb:test parameters.static
test("parameters.static: the static route wins over the capture that also matches it", async () => {
  const response = await app.request("/parameters/static/segment/literal");

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), expected.json("items.small.json"));
});

// rb:test parameters.one
test("parameters.one: the capture is echoed as an integer", async () => {
  const response = await app.request(`/parameters/${run.one}/segment/literal`);

  assert.deepEqual(await response.json(), expected.withEcho("items.small.json", { one: run.one }));
});

// rb:test parameters.two
test("parameters.two: both captures are echoed as integers", async () => {
  const response = await app.request(`/parameters/${run.one}/with-second/${run.two}`);

  assert.deepEqual(await response.json(), expected.withEcho("items.small.json", { one: run.one, two: run.two }));
});

test("a capture that is not an integer is refused by the params schema", async () => {
  const response = await app.request("/parameters/four/segment/literal");

  assert.equal(response.status, 400);
  const refusal = (await response.json()) as { data: { issues: { path: string[] }[] } };
  assert.deepEqual(refusal.data.issues.map((i) => i.path), [["one"]]);
});
