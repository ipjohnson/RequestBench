import assert from "node:assert/strict";
import { test } from "node:test";

import { client, expected } from "./app.ts";

const post = (url: string, body: string | Buffer) => client.post(url).set("content-type", "application/json").send(body.toString());

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
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { fields: 2 + 2 * order.lines.length, bytes: body.length, echo: order });
  });
}

const params = { customerId: 0, status: "", lines: [] };

// rb:test body.rejected_all
test("body.rejected_all: koa-parameter refuses order.invalid with 422, naming all three fields", async () => {
  const response = await post("/body/validate/small", expected.bytes("order.invalid.json"));

  assert.equal(response.status, 422);
  assert.deepEqual(response.body, {
    message: "Validation Failed",
    errors: [
      { message: "should bigger than 1", code: "invalid", field: "customerId" },
      { message: "should not be empty", code: "invalid", field: "status" },
      { message: "length should bigger than 1", code: "invalid", field: "lines" },
    ],
    params,
  });
});

// rb:test body.rejected_first
test("body.rejected_first: the first-error route stops at the first field that fails", async () => {
  const response = await post("/body/validate/first-error", expected.bytes("order.invalid.json"));

  assert.equal(response.status, 422);
  assert.deepEqual(response.body, {
    message: "Validation Failed",
    errors: [{ message: "should bigger than 1", code: "invalid", field: "customerId" }],
    params,
  });
});

test("a bad line is named by its index", async () => {
  const response = await post("/body/validate/small", '{"customerId":1,"status":"open","lines":[{"productId":1,"qty":0}]}');

  assert.deepEqual(response.body.errors, [{ message: "should bigger than 1", code: "invalid", field: "lines[0].qty" }]);
});

test("the bind routes check no rule", async () => {
  const response = await post("/body/bind/small", expected.bytes("order.invalid.json"));

  assert.equal(response.status, 200);
  assert.equal(response.body.fields, 2);
});
