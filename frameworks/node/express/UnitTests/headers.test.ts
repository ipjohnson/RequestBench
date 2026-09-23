import assert from "node:assert/strict";
import { test } from "node:test";

import request from "supertest";

import { app, expected, run } from "./app.ts";

/**
 * The three headers the binding rows bind, and as many more as asked that nothing reads. The many
 * rows send twenty-five of those.
 */
function headers(unread: number): Record<string, string> {
  const sent: Record<string, string> = { "x-rb-tenant": run.tenant, "x-rb-request-id": run.requestId, "x-rb-account": String(run.account) };
  for (let i = 0; i < unread; i++) sent[`x-rb-unread-${i}`] = "unread";
  return sent;
}

// rb:test headers.few,headers.many
for (const [id, unread] of [["headers.few", 0], ["headers.many", 25]] as const) {
  test(`${id}: headers nothing reads leave the answer alone`, async () => {
    const response = await request(app).get("/headers").set(headers(unread));

    assert.deepEqual(response.body, expected.json("items.small.json"));
  });
}

// rb:test headers.bind_few,headers.bind_many
for (const [id, unread] of [["headers.bind_few", 0], ["headers.bind_many", 25]] as const) {
  test(`${id}: three headers are read and echoed, the account as an integer`, async () => {
    const response = await request(app).get("/headers/bind").set(headers(unread));

    const echo = { tenant: run.tenant, requestId: run.requestId, account: run.account };
    assert.deepEqual(response.body, expected.withEcho("items.small.json", echo));
  });
}
