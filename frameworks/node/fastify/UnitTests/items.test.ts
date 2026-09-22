import assert from "node:assert/strict";
import { test } from "node:test";

import { app, expected } from "./app.ts";

const json = (method: "POST" | "PUT" | "PATCH", url: string, file: string) =>
  app.inject({ method, url, headers: { "content-type": "application/json" }, payload: expected.bytes(file) });

// rb:test items.read
test("items.read: a row is read by the id in the path", async () => {
  const response = await app.inject({ method: "GET", url: "/items/17" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), expected.row(17));
});

// rb:test items.head
test("items.head: HEAD is answered by the GET route, with no body", async () => {
  const response = await app.inject({ method: "HEAD", url: "/items/17" });

  assert.equal(response.statusCode, 200);
  assert.match(response.headers["content-type"] as string, /^application\/json/);
  assert.equal(response.rawPayload.length, 0);
});

// rb:test items.create
test("items.create: a created item is the row after the last", async () => {
  const response = await json("POST", "/items", "items.new.json");

  assert.equal(response.statusCode, 201);
  assert.equal(response.headers["location"], "/items/1426");
  assert.deepEqual(response.json(), { id: 1426, ...expected.json("items.new.json") });
});

// rb:test items.replace
test("items.replace: a replaced item takes the id in the path", async () => {
  const response = await json("PUT", "/items/17", "items.new.json");

  assert.deepEqual(response.json(), { id: 17, ...expected.json("items.new.json") });
});

// rb:test items.update
test("items.update: a patch is merged onto the row", async () => {
  const response = await json("PATCH", "/items/17", "items.patch.json");

  assert.deepEqual(response.json(), { ...expected.row(17), ...expected.json("items.patch.json") });
});

// rb:test items.delete
test("items.delete: a delete is answered 204 with no body", async () => {
  const response = await app.inject({ method: "DELETE", url: "/items/17" });

  assert.equal(response.statusCode, 204);
  assert.equal(response.rawPayload.length, 0);
});

test("a patch or a delete of a missing row is 404", async () => {
  assert.equal((await json("PATCH", "/items/999999", "items.patch.json")).statusCode, 404);
  assert.equal((await app.inject({ method: "DELETE", url: "/items/999999" })).statusCode, 404);
});
