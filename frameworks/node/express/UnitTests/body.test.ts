import assert from "node:assert/strict";
import { test } from "node:test";

import request from "supertest";

import { app, expected } from "./app.ts";

// A string, because supertest serialises a Buffer sent as JSON rather than sending its bytes.
const post = (url: string, body: string) => request(app).post(url).set("content-type", "application/json").send(body);

/** One of express-validator's field errors, as result.array() lists it. */
const invalid = (path: string, value: unknown) => ({ type: "field", value, msg: "Invalid value", path, location: "body" });

// rb:test body.bind_small,body.bind_medium,body.validate_small,body.validate_medium
for (const [id, url, file] of [
  ["body.bind_small", "/body/bind/small", "order.small.json"],
  ["body.bind_medium", "/body/bind/medium", "order.medium.json"],
  ["body.validate_small", "/body/validate/small", "order.small.json"],
  ["body.validate_medium", "/body/validate/medium", "order.medium.json"],
] as const) {
  test(`${id}: an order is answered with its leaves, its length and itself`, async () => {
    const body = expected.text(file);

    const response = await post(url, body);

    const order = expected.json(file) as { lines: unknown[] };
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { fields: 2 + 2 * order.lines.length, bytes: Buffer.byteLength(body), echo: order });
  });
}

// rb:test body.rejected_all
test("body.rejected_all: every chain runs, and the refusal names all three bad fields", async () => {
  const response = await post("/body/validate/small", expected.text("order.invalid.json"));

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, { errors: [invalid("customerId", 0), invalid("status", ""), invalid("lines", [])] });
});

// rb:test body.rejected_first
test("body.rejected_first: the chains run one at a time, and the refusal names the first bad field", async () => {
  const response = await post("/body/validate/first-error", expected.text("order.invalid.json"));

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, { errors: [invalid("customerId", 0)] });
});

test("a bad line is named by its path", async () => {
  const response = await post("/body/validate/small", '{"customerId":1,"status":"open","lines":[{"productId":1,"qty":0}]}');

  assert.deepEqual(response.body, { errors: [invalid("lines[0].qty", 0)] });
});

test("express-validator reads a value's string form, so a number sent as a string passes", async () => {
  const response = await post("/body/validate/small", '{"customerId":"7","status":"open","lines":[{"productId":1,"qty":1}]}');

  assert.equal(response.status, 200);
  assert.equal(response.body.echo.customerId, "7");
});

test("the bind routes run no chain", async () => {
  const response = await post("/body/bind/small", expected.text("order.invalid.json"));

  assert.equal(response.status, 200);
  assert.equal(response.body.fields, 2);
});
