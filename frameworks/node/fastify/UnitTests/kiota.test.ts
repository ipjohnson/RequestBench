// The Kiota client in Client/, generated from the document @fastify/swagger writes, calling the
// Implementation through inject(). These hold the client to what Fastify answers, not Fastify to a
// corpus row, so no name starts with a corpus id.
import assert from "node:assert/strict";
import { test } from "node:test";

import { AnonymousAuthenticationProvider } from "@microsoft/kiota-abstractions";
import { DefaultRequestAdapter } from "@microsoft/kiota-bundle";
import { KiotaClientFactory } from "@microsoft/kiota-http-fetchlibrary";

import { createFastifyClient } from "../Client/Kiota/fastifyClient.ts";
import { app, expected, run } from "./app.ts";

/** Kiota's fetch, answered by inject() so nothing listens. */
async function inject(url: string, init: RequestInit): Promise<Response> {
  const target = new URL(url);
  const body = init.body;
  const payload = body == null ? undefined : typeof body === "string" ? body : Buffer.from(body as ArrayBuffer);
  const answer = await app.inject({
    method: (init.method ?? "GET") as "GET",
    url: target.pathname + target.search,
    headers: Object.fromEntries(new Headers(init.headers)),
    ...(payload === undefined ? {} : { payload }),
  });
  const headers = new Headers();
  for (const [name, value] of Object.entries(answer.headers)) if (value !== undefined) headers.set(name, String(value));
  const empty = answer.statusCode === 204 || init.method === "HEAD";
  return new Response(empty ? null : answer.rawPayload, { status: answer.statusCode, headers });
}

const adapter = new DefaultRequestAdapter(new AnonymousAuthenticationProvider(), undefined, undefined, KiotaClientFactory.create(inject));
adapter.baseUrl = "http://fastify";
const client = createFastifyClient(adapter);

test("kiota: json.small is the payload", async () => {
  const answer = await client.json.small.get();

  assert.equal(answer?.count, 1);
  assert.equal(answer?.items?.[0]?.name, (expected.json("items.small.json").items as { name: string }[])[0]!.name);
});

test("kiota: a row is typed by the response schema", async () => {
  const answer = await client.items.byId(17).get();

  assert.equal(answer?.id, 17);
  assert.equal(answer?.name, expected.row(17).name);
});

test("kiota: a validated order is typed by the body schema", async () => {
  const answer = await client.body.validate.small.post({ customerId: 1, status: "open", lines: [{ productId: 1, qty: 1 }] });

  assert.equal(answer?.fields, 4);
  assert.equal(answer?.echo?.customerId, 1);
});

test("kiota: a rejected order is an error with the status", async () => {
  const refused = client.body.validate.small.post({ customerId: 0, status: "", lines: [] });

  await assert.rejects(refused, (error: { responseStatusCode?: number }) => error.responseStatusCode === 400);
});

test("kiota: path and header parameters", async () => {
  const path = await client.parameters.byOne(run.one).withSecond.byTwo(run.two).get();
  const headers = await client.headers.bind.get({
    headers: { "x-rb-tenant": run.tenant, "x-rb-request-id": run.requestId, "x-rb-account": String(run.account) },
  });

  assert.deepEqual([path?.echo?.one, path?.echo?.two], [run.one, run.two]);
  assert.equal(headers?.echo?.account, run.account);
});

test("kiota: a query parameter, on the /query routes", async () => {
  const answer = await client.query.one.get({ queryParameters: { page: run.page } });

  assert.equal(answer?.echo?.page, run.page);
});
