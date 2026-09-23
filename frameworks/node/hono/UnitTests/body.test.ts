import assert from "node:assert/strict";
import { test } from "node:test";

import { expected, postJson } from "./app.ts";

/** The fields zod's issues name, read out of the JSON string zod 4 keeps them in. */
async function named(response: Response): Promise<string[]> {
  const body = (await response.json()) as { success: boolean; error: { name: string; message: string } };
  assert.equal(body.success, false);
  assert.equal(body.error.name, "ZodError");
  return (JSON.parse(body.error.message) as { path: (string | number)[] }[]).map((issue) => issue.path.join("."));
}

// rb:test body.bind_small,body.bind_medium,body.validate_small,body.validate_medium
for (const [id, url, file] of [
  ["body.bind_small", "/body/bind/small", "order.small.json"],
  ["body.bind_medium", "/body/bind/medium", "order.medium.json"],
  ["body.validate_small", "/body/validate/small", "order.small.json"],
  ["body.validate_medium", "/body/validate/medium", "order.medium.json"],
] as const) {
  test(`${id}: an order is answered with its leaves, its length and itself`, async () => {
    const body = expected.bytes(file);

    const response = await postJson(url, body);

    const order = expected.json(file) as { lines: unknown[] };
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { fields: 2 + 2 * order.lines.length, bytes: body.length, echo: order });
  });
}

// rb:test body.rejected_all
test("body.rejected_all: zValidator refuses order.invalid with 400, naming each of its three bad fields", async () => {
  const response = await postJson("/body/validate/small", expected.bytes("order.invalid.json"));

  assert.equal(response.status, 400);
  assert.deepEqual(await named(response), ["customerId", "status", "lines"]);
});

// rb:test body.rejected_first
test("body.rejected_first: the first-error route stops at customerId", async () => {
  const response = await postJson("/body/validate/first-error", expected.bytes("order.invalid.json"));

  assert.equal(response.status, 400);
  assert.deepEqual(await named(response), ["customerId"]);
});

test("the first-error route checks each field in turn, and then the whole order", async () => {
  const lines = await postJson("/body/validate/first-error", '{"customerId":1,"status":"open","lines":[{"productId":1,"qty":0}]}');
  const extra = await postJson("/body/validate/first-error", '{"customerId":1,"status":"open","lines":[{"productId":1,"qty":1}],"note":"x"}');

  assert.deepEqual(await named(lines), ["lines.0.qty"]);
  assert.equal(extra.status, 400);
});

test("a bad line is named by its path", async () => {
  const response = await postJson("/body/validate/small", '{"customerId":1,"status":"open","lines":[{"productId":1,"qty":0}]}');

  assert.deepEqual(await named(response), ["lines.0.qty"]);
});

test("the bind routes run no schema", async () => {
  const response = await postJson("/body/bind/small", expected.bytes("order.invalid.json"));

  assert.equal(response.status, 200);
  assert.equal(((await response.json()) as { fields: number }).fields, 2);
});
