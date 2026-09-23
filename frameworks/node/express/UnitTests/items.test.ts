import assert from "node:assert/strict";
import { test } from "node:test";

import request from "supertest";

import { app, expected } from "./app.ts";

// A string, because supertest serialises a Buffer sent as JSON rather than sending its bytes.
const json = (method: "post" | "put" | "patch", url: string, file: string) =>
  request(app)[method](url).set("content-type", "application/json").send(expected.text(file));

// rb:test items.read
test("items.read: a row is read by the id in the path", async () => {
  const response = await request(app).get("/items/17");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, expected.row(17));
});

// rb:test items.head
test("items.head: HEAD is answered by the GET route, with no body", async () => {
  const response = await request(app).head("/items/17");

  assert.equal(response.status, 200);
  assert.match(response.headers["content-type"]!, /^application\/json/);
  assert.equal(response.text ?? "", "");
});

// rb:test items.create
test("items.create: a created item is the row after the last", async () => {
  const response = await json("post", "/items", "items.new.json");

  assert.equal(response.status, 201);
  assert.equal(response.headers["location"], "/items/1426");
  assert.deepEqual(response.body, { id: 1426, ...expected.json("items.new.json") });
});

// rb:test items.replace
test("items.replace: a replaced item takes the id in the path", async () => {
  const response = await json("put", "/items/17", "items.new.json");

  assert.deepEqual(response.body, { id: 17, ...expected.json("items.new.json") });
});

// rb:test items.update
test("items.update: a patch is merged onto the row", async () => {
  const response = await json("patch", "/items/17", "items.patch.json");

  assert.deepEqual(response.body, { ...expected.row(17), ...expected.json("items.patch.json") });
});

// rb:test items.delete
test("items.delete: a delete is answered 204 with no body", async () => {
  const response = await request(app).delete("/items/17");

  assert.equal(response.status, 204);
  assert.equal(response.text ?? "", "");
});

test("a patch or a delete of a missing row is 404", async () => {
  assert.equal((await json("patch", "/items/999999", "items.patch.json")).status, 404);
  assert.equal((await request(app).delete("/items/999999")).status, 404);
});
