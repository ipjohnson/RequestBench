import assert from "node:assert/strict";
import { test } from "node:test";

import { app, expected, run } from "./app.ts";

const SEARCH = ["page", "size", "status", "category", "sort", "q", "minPrice", "maxPrice"] as const;
const BOUNDARY = "rb-7c4f1e0a9d";

function part(disposition: string, body: string | Buffer, type?: string): Buffer {
  const typed = type === undefined ? "" : `Content-Type: ${type}\r\n`;
  return Buffer.concat([Buffer.from(`--${BOUNDARY}\r\nContent-Disposition: form-data; ${disposition}\r\n${typed}\r\n`), Buffer.from(body), Buffer.from("\r\n")]);
}

// rb:test forms.urlencoded
test("forms.urlencoded: query.many's eight values from a form, the numbers as integers", async () => {
  const form = new URLSearchParams(SEARCH.map((name) => [name, String(run[name])])).toString();

  const response = await app.request("/forms/urlencoded", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form });

  assert.deepEqual(await response.json(), expected.withEcho("items.small.json", Object.fromEntries(SEARCH.map((name) => [name, run[name]]))));
});

// rb:test forms.multipart
test("forms.multipart: the file is read to its end and the fields are echoed", async () => {
  const file = expected.bytes("forms.file.txt");
  const body = Buffer.concat([
    part('name="tenant"', run.tenant),
    part('name="requestId"', run.requestId),
    part('name="file"; filename="forms.file.txt"', file, "text/plain"),
    Buffer.from(`--${BOUNDARY}--\r\n`),
  ]);

  const response = await app.request("/forms/multipart", { method: "POST", headers: { "content-type": `multipart/form-data; boundary=${BOUNDARY}` }, body });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { file: { name: "forms.file.txt", bytes: file.length }, echo: { tenant: run.tenant, requestId: run.requestId } });
});
