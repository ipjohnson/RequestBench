import assert from "node:assert/strict";
import { test } from "node:test";

import { app, expected, postJson } from "./app.ts";

// rb:test items.read
test("items.read: a row is read by the id in the path", async () => {
  const response = await app.request("/items/17");

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), expected.row(17));
});

// rb:test items.head
test("items.head: HEAD is answered by the GET route, with no body", async () => {
  const response = await app.request("/items/17", { method: "HEAD" });

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type")!, /^application\/json/);
  assert.equal((await response.arrayBuffer()).byteLength, 0);
});

// rb:test items.create
test("items.create: a created item is the row after the last", async () => {
  const response = await postJson("/items", expected.bytes("items.new.json"));

  assert.equal(response.status, 201);
  assert.equal(response.headers.get("location"), "/items/1426");
  assert.deepEqual(await response.json(), { id: 1426, ...expected.json("items.new.json") });
});

// rb:test items.replace
test("items.replace: a replaced item takes the id in the path", async () => {
  const response = await postJson("/items/17", expected.bytes("items.new.json"), "PUT");

  assert.deepEqual(await response.json(), { id: 17, ...expected.json("items.new.json") });
});

// rb:test items.update
test("items.update: a patch is merged onto the row", async () => {
  const response = await postJson("/items/17", expected.bytes("items.patch.json"), "PATCH");

  assert.deepEqual(await response.json(), { ...expected.row(17), ...expected.json("items.patch.json") });
});

// rb:test items.delete
test("items.delete: a delete is answered 204 with no body", async () => {
  const response = await app.request("/items/17", { method: "DELETE" });

  assert.equal(response.status, 204);
  assert.equal((await response.arrayBuffer()).byteLength, 0);
});

test("a patch or a delete of a missing row is 404", async () => {
  assert.equal((await postJson("/items/999999", expected.bytes("items.patch.json"), "PATCH")).status, 404);
  assert.equal((await app.request("/items/999999", { method: "DELETE" })).status, 404);
});
