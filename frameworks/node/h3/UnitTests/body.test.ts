import assert from "node:assert/strict";
import { test } from "node:test";

import { app, expected } from "./app.ts";

const post = (url: string, body: string | Buffer) =>
  app.request(url, { method: "POST", headers: { "content-type": "application/json", "content-length": String(Buffer.byteLength(body)) }, body });

/** The path of each issue h3's validation error lists. */
const paths = async (response: Response) =>
  ((await response.json()) as { data: { issues: { path: (string | number)[] }[] } }).data.issues.map((i) => i.path);

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
    assert.deepEqual(await response.json(), { fields: 2 + 2 * order.lines.length, bytes: body.length, echo: order });
  });
}

// rb:test body.rejected_all
test("body.rejected_all: the schema refuses order.invalid, naming its three bad fields", async () => {
  const response = await post("/body/validate/small", expected.bytes("order.invalid.json"));

  assert.equal(response.status, 400);
  assert.equal(response.statusText, "Validation failed");
  assert.deepEqual(await paths(response), [["customerId"], ["status"], ["lines"]]);
});

// rb:test body.rejected_first
test("body.rejected_first: the first-error route stops at order.invalid's first bad field", async () => {
  const response = await post("/body/validate/first-error", expected.bytes("order.invalid.json"));

  assert.equal(response.status, 400);
  assert.deepEqual(await paths(response), [["customerId"]]);
});

test("the first-error route names a later field once the earlier ones pass", async () => {
  const response = await post("/body/validate/first-error", '{"customerId":1,"status":"","lines":[]}');

  assert.deepEqual(await paths(response), [["status"]]);
});

test("a bad line is named by its path", async () => {
  const response = await post("/body/validate/small", '{"customerId":1,"status":"open","lines":[{"productId":1,"qty":0}]}');

  assert.deepEqual(await paths(response), [["lines", 0, "qty"]]);
});

test("the bind routes run no schema", async () => {
  const response = await post("/body/bind/small", expected.bytes("order.invalid.json"));

  assert.equal(response.status, 200);
  assert.equal(((await response.json()) as { fields: number }).fields, 2);
});
