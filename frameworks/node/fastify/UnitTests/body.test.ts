import assert from "node:assert/strict";
import { test } from "node:test";

import { app, expected } from "./app.ts";

const post = (url: string, payload: string | Buffer) =>
  app.inject({ method: "POST", url, headers: { "content-type": "application/json" }, payload });

// rb:test body.bind_small,body.bind_medium,body.validate_small,body.validate_medium
for (const [id, url, file] of [
  ["body.bind_small", "/body/bind/small", "order.small.json"],
  ["body.bind_medium", "/body/bind/medium", "order.medium.json"],
  ["body.validate_small", "/body/validate/small", "order.small.json"],
  ["body.validate_medium", "/body/validate/medium", "order.medium.json"],
] as const) {
  test(`${id}: an order is answered with its leaves, its length and itself`, async () => {
    const body = expected.bytes(file);

    const response = await post(url, body);

    const order = expected.json(file) as { lines: unknown[] };
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { fields: 2 + 2 * order.lines.length, bytes: body.length, echo: order });
  });
}

// rb:test body.rejected_all,body.rejected_first
for (const [id, url] of [["body.rejected_all", "/body/validate/small"], ["body.rejected_first", "/body/validate/first-error"]] as const) {
  test(`${id}: the schema refuses order.invalid, naming its first bad field`, async () => {
    const response = await post(url, expected.bytes("order.invalid.json"));

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.json(), {
      statusCode: 400,
      code: "FST_ERR_VALIDATION",
      error: "Bad Request",
      message: "body/customerId must be > 0",
    });
  });
}

test("a bad line is named by its pointer", async () => {
  const response = await post("/body/validate/small", '{"customerId":1,"status":"open","lines":[{"productId":1,"qty":0}]}');

  assert.equal(response.json().message, "body/lines/0/qty must be > 0");
});

test("the bind routes run no schema", async () => {
  const response = await post("/body/bind/small", expected.bytes("order.invalid.json"));

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().fields, 2);
});
