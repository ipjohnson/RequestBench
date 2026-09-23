import assert from "node:assert/strict";
import { test } from "node:test";

import { app, expected } from "./app.ts";

const json = (method: "POST" | "PUT" | "PATCH", url: string, file: string) =>
  app.request(url, { method, headers: { "content-type": "application/json" }, body: expected.bytes(file) });

// rb:test items.read
test("items.read: a row is read by the id in the path", async () => {
  const response = await app.request("/items/17");

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), expected.row(17));
});

// rb:test items.head
test("items.head: HEAD is answered by the GET route, with its content type", async () => {
  const response = await app.request("/items/17", { method: "HEAD" });

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type")!, /^application\/json/);
});

// rb:test items.create
test("items.create: a created item is the row after the last", async () => {
  const response = await json("POST", "/items", "items.new.json");

  assert.equal(response.status, 201);
  assert.equal(response.headers.get("location"), "/items/1426");
  assert.deepEqual(await response.json(), { id: 1426, ...expected.json("items.new.json") });
});

// rb:test items.replace
test("items.replace: a replaced item takes the id in the path", async () => {
  const response = await json("PUT", "/items/17", "items.new.json");

  assert.deepEqual(await response.json(), { id: 17, ...expected.json("items.new.json") });
});

// rb:test items.update
test("items.update: a patch is merged onto the row", async () => {
  const response = await json("PATCH", "/items/17", "items.patch.json");

  assert.deepEqual(await response.json(), { ...expected.row(17), ...expected.json("items.patch.json") });
});

// rb:test items.delete
test("items.delete: a delete is answered 204 with no body", async () => {
  const response = await app.request("/items/17", { method: "DELETE" });

  assert.equal(response.status, 204);
  assert.equal((await response.arrayBuffer()).byteLength, 0);
});

test("a patch or a delete of a missing row is 404", async () => {
  assert.equal((await json("PATCH", "/items/999999", "items.patch.json")).status, 404);
  assert.equal((await app.request("/items/999999", { method: "DELETE" })).status, 404);
});
