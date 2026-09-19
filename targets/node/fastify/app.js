// RequestBench target: Fastify. Framework wiring only; behaviour comes from _shared/domain.js.
//
// `listen` starts Fastify's own server, which is what people deploy. `handler` is
// Fastify's routing exposed as a plain (req, res), which is what a function host invokes.
//
// Every feature family here uses Fastify's own facility rather than an if in the handler,
// and each one is scoped to its own routes. Compression registered globally would put a
// "did they ask?" check on all forty-two endpoints and contaminate the baseline the
// compressed rows are measured against, which is the whole reason those rows have their
// own paths instead of riding on /json with an accept-encoding header.
import Fastify from "fastify";
import abstractCache from "abstract-cache";
// rb:wiring cache.*
import caching from "@fastify/caching";
// rb:wiring compressed.*
import compress from "@fastify/compress";
// rb:wiring etag.*
import etag from "@fastify/etag";
// rb:wiring template.*
import view from "@fastify/view";
import ejs from "ejs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { constants } from "node:zlib";
import { pkgVersion } from "../_shared/version.js";
import { hostMeta } from "../_shared/host.js";
import * as d from "../_shared/domain.js";
import { orderOf, validatesOrder } from "./validation.js";
import { bindsFilter, bindsMany, bindsOne } from "./query.js";
import * as s from "./serialization.js";

const meta = { framework: "fastify", version: pkgVersion("fastify"),
               runtime: "node " + process.versions.node, template: "ejs",
               etag: "@fastify/etag fnv1a",
               cache: "@fastify/caching " + pkgVersion("@fastify/caching")
                      + " store, fastify hooks" };

// rb:wiring template.*
const VIEWS = join(dirname(fileURLToPath(import.meta.url)), "views");

const app = Fastify({ logger: false, disableRequestLogging: true });

// rb:wiring errors.*
// Same reason as the baseline: when a function host has already parsed the body, Fastify
// must not try to read the stream again. Its own parser still runs under `container`.
app.addContentTypeParser("application/json", (req, payload, done) => {
  if (req.raw.body !== undefined) return done(null, req.raw.body);
  let data = "";
  payload.on("data", (c) => (data += c));
  payload.on("end", () => {
    // Fastify's own parse failure, so its error handler answers it rather than a shared
    // envelope standing in for one.
    try { done(null, data.length ? JSON.parse(data) : undefined); }
    catch (e) { done(Object.assign(e, { statusCode: 400, code: "FST_ERR_CTP_INVALID_JSON" })); }
  });
});

// rb:wiring domain.*,errors.*
const send = (reply, v, status = 200) =>
  v === d.NOT_FOUND ? reply.code(404).send({ error: "not_found" }) : reply.code(status).send(v);
// rb:wiring parameters.*,headers.*,middleware.*,authorized.*
const small = () => d.payload("small");
// rb:wiring json.*
const payloadOnly = s.responds({ 200: s.payload });

// ---- baseline, json, parameters, query, headers, middleware --------------------------

app.get("/plaintext", (_, reply) => reply.type("text/plain").send("Hello, World!"));
app.get("/health",    (_, reply) => reply.type("text/plain").send("ok"));
app.get("/__meta",    () => ({ ...meta, ...hostMeta() }));

app.get("/json/small",  payloadOnly, () => d.payload("small"));
app.get("/json/medium", payloadOnly, () => d.payload("medium"));
app.get("/json/large",  payloadOnly, () => d.payload("large"));

// rb:wiring parameters.*
// schema.params is the binding: ajv converts each declared capture to an integer before the
// handler runs, so req.params is already what the echo holds.
const bindsOneCapture = {
  schema: { params: { type: "object", properties: { one: { type: "integer" } } } },
};

// rb:wiring parameters.*
const bindsTwoCaptures = {
  schema: {
    params: { type: "object", properties: { one: { type: "integer" }, two: { type: "integer" } } },
  },
};

// find-my-way tries a static segment before a capture, so /parameters/static/segment/literal
// reaches its own route rather than the one-capture route that also matches it.
app.get("/parameters/static/segment/literal", payloadOnly, small);
app.get("/parameters/:one/segment/literal",
  s.responds({ 200: s.withEcho(bindsOneCapture.schema.params.properties) }, bindsOneCapture),
  (req) => d.withEcho("small", req.params));
app.get("/parameters/:one/with-second/:two",
  s.responds({ 200: s.withEcho(bindsTwoCaptures.schema.params.properties) }, bindsTwoCaptures),
  (req) => d.withEcho("small", req.params));

// The schema is the binding: ajv coerces the declared parameters and drops the rest, so
// req.query is already the echo.
app.get("/query/one",
  s.responds({ 200: s.withEcho(bindsOne.schema.querystring.properties) }, bindsOne),
  (req) => d.withEcho("small", req.query));
app.get("/query/many",
  s.responds({ 200: s.withEcho(bindsMany.schema.querystring.properties) }, bindsMany),
  (req) => d.withEcho("small", req.query));

// The handler reads no header at all, so headers.many minus headers.few is the cost of
// materialising 25 more that nobody asked for.
app.get("/headers", payloadOnly, small);

// rb:wiring headers.*
// schema.headers is the binding: ajv converts x-rb-account to an integer before the handler
// runs, so req.headers already holds the three values the echo needs.
const bindsHeaders = {
  schema: {
    headers: {
      type: "object",
      properties: {
        "x-rb-tenant": { type: "string" },
        "x-rb-request-id": { type: "string" },
        "x-rb-account": { type: "integer" },
      },
    },
  },
};

app.get("/headers/bind", s.responds({ 200: s.headersEcho }, bindsHeaders), (req) => d.withEcho("small", {
  tenant: req.headers["x-rb-tenant"],
  request_id: req.headers["x-rb-request-id"],
  account: req.headers["x-rb-account"],
}));

// rb:wiring middleware.*
// Fastify's middleware is its hooks, and a route-level hook array is how you scope them to
// one route. Each layer calls done() and does nothing else.
const noop = (_req, _reply, done) => done();
const layers = (n) => Array.from({ length: n }, () => noop);
// rb:end
app.get("/middleware/none", payloadOnly, small);
app.get("/middleware/four", s.responds({ 200: s.payload }, { onRequest: layers(4) }), small);
app.get("/middleware/sixteen", s.responds({ 200: s.payload }, { onRequest: layers(16) }), small);

// ---- authorized: a route-scoped onRequest hook, not an if in the handler --------------

// rb:wiring authorized.*
const requireToken = (req, reply, done) => {
  if (d.tokenOk(req.headers.authorization)) return done();
  reply.code(403).send({ error: "forbidden" });
};
app.get("/authorized/small",
  s.responds({ 200: s.payload, 403: s.refusal }, { onRequest: requireToken }), small);

// ---- compressed: @fastify/compress, registered in its own encapsulated scope ----------

// rb:handler compressed.*
app.register(async (scope) => {
  // Threshold is left at the plugin's own default. Whether a framework bothers to compress
  // a body too small to benefit is one of the things compressed.small is there to show, so
  // forcing it here would erase the answer.
  await scope.register(compress, {
    encodings: ["gzip"], zlibOptions: { level: constants.Z_BEST_SPEED },
  });
  for (const size of ["small", "medium", "large"])
    scope.get("/compressed/" + size, payloadOnly, (_, reply) =>
      reply.header("x-rb-serial", d.nextSerial()).send(d.payload(size)));
});

// ---- etag: @fastify/etag, registered in its own encapsulated scope --------------------

// rb:handler etag.*
// The plugin hashes the payload Fastify is about to serialize and answers the conditional
// itself, so nothing here compares anything. Encapsulation is what scopes it: registered on
// the root instance it would hash every response in the blend and contaminate the baseline
// these rows subtract. fnv1a is the plugin's own default, which is why /__meta names it.
app.register(async (scope) => {
  await scope.register(etag);
  for (const size of ["small", "large"])
    scope.get("/etag/" + size, payloadOnly, (_, reply) =>
      reply.header("cache-control", d.CACHEABLE).header("x-rb-serial", d.nextSerial())
           .send(d.payload(size)));
});

// ---- cache: the handler skipped and a stored response replayed ------------------------

// rb:wiring cache.*
// Fastify ships no response cache. @fastify/caching is the plugin it ships for caching, and
// what it contributes is the store: an abstract-cache client, sized here from the fixture
// so the capacity derived from the key count means what it says. The replay is two of
// Fastify's own hooks around it, onRequest to answer and onSend to store, which is the
// framework's own mechanism rather than a lookup inside a handler.
//
// One consequence worth naming: a hit still enters onRequest, so what is skipped is the
// handler and the serializer rather than the whole dispatch.
const store = abstractCache({
  useAwait: true,
  driver: { options: { maxItems: d.CACHE_MAX, segment: "rb" } },
});

// rb:wiring cache.*
const replay = (on) => {
  const keyOf = (req) =>
    on.length === 0 ? req.url : req.url + "|" + on.map((h) => req.headers[h] ?? "").join("|");
  return {
    onRequest: async (req, reply) => {
      const hit = await store.get(keyOf(req));
      if (!hit) return;
      for (const [k, v] of Object.entries(hit.item.headers)) reply.header(k, v);
      return reply.code(hit.item.status).send(hit.item.body);
    },
    onSend: async (req, reply, payload) => {
      if (reply.statusCode === 200 && !(await store.has(keyOf(req)))) {
        await store.set(keyOf(req), {
          status: 200, headers: reply.getHeaders(), body: payload,
        }, d.CACHE_TTL_MS);
      }
      return payload;
    },
  };
};

app.register(async (scope) => {
  await scope.register(caching, { privacy: caching.privacy.PUBLIC, expiresIn: 60 });
  // rb:handler cache.small,cache.medium,cache.large
  for (const size of ["small", "medium", "large"])
    scope.get("/cache/" + size, s.responds({ 200: s.payload }, replay([])),
      (_, reply) => reply.header("x-rb-serial", d.nextSerial()).send(d.payload(size)));
  // rb:handler cache.vary_one,cache.vary_many
  for (const which of ["one", "many"]) {
    const on = d.varyOn(which);
    scope.get("/cache/vary/" + which, s.responds({ 200: s.payload }, replay(on)), (_, reply) =>
      reply.header("vary", on.join(", ")).header("x-rb-serial", d.nextSerial())
           .send(d.payload("small")));
  }
});

// ---- body: bind, validate, and the two rejection contracts ---------------------------

app.post("/body/bind/small",  s.responds({ 200: s.bound }), (req) => d.bindEcho(req.body));
app.post("/body/bind/medium", s.responds({ 200: s.bound }), (req) => d.bindEcho(req.body));
// schema.body is the wiring: Fastify compiles it once and ajv runs it before the handler,
// so no handler calls a validator and a body that fails never reaches one. A body that
// fails is answered by setErrorHandler, which the 4xx schema serializes.
const pricesOrder = s.responds({ 200: s.pricedOrder, "4xx": s.envelope }, validatesOrder);
app.post("/body/validate/small",  pricesOrder, (req) => orderOf(req.body));
app.post("/body/validate/medium", pricesOrder, (req) => orderOf(req.body));
// Fastify runs ajv with allErrors: false, which reports the first failure and nothing after
// it. That is the framework's own setting, so this row answers what Fastify answers and the
// gap to body.rejected_all is what Fastify costs rather than the same walk written twice.
app.post("/body/validate/first-error", pricesOrder, (req) => orderOf(req.body));

// ---- domain --------------------------------------------------------------------------

app.get("/domain/orders", s.responds({ 200: s.orderPage }, bindsFilter),
  (req) => d.domainFilter(req.query.page, req.query.size, req.query.status));
app.get("/domain/orders/:oid", s.responds({ 200: s.order, 404: s.refusal }),
  (req, reply) => send(reply, d.getOrder(req.params.oid)));
app.get("/domain/customers/:cid/summary", s.responds({ 200: s.customerSummary, 404: s.refusal }),
  (req, reply) => send(reply, d.domainJoin(req.params.cid)));
app.get("/domain/regions/:r/report", s.responds({ 200: s.regionReport, 404: s.refusal }),
  (req, reply) => send(reply, d.domainAggregate(req.params.r)));
app.post("/domain/orders", s.responds({ 201: s.pricedOrder, "4xx": s.envelope }, validatesOrder),
  (req, reply) =>
    reply.code(201).header("location", "/domain/orders/" + d.NEXT_ORDER_ID)
         .send(orderOf(req.body)));
app.put("/domain/orders/:oid",
  s.responds({ 200: s.replacedOrder, 404: s.refusal, "4xx": s.envelope }, validatesOrder),
  (req, reply) =>
    d.getOrder(req.params.oid) === d.NOT_FOUND
      ? reply.code(404).send({ error: "not_found" })
      : reply.send({ id: Number(req.params.oid), ...orderOf(req.body) }));
app.patch("/domain/customers/:cid", s.responds({ 200: s.customer, 404: s.refusal }),
  (req, reply) => send(reply, d.patchCustomer(req.params.cid, req.body)));
app.delete("/domain/orders/:oid/lines/:lid", s.responds({ 404: s.refusal }), (req, reply) =>
  d.getOrderLine(req.params.oid, req.params.lid) === d.NOT_FOUND
    ? reply.code(404).send({ error: "not_found" })
    : reply.code(204).send());

// ---- template: the engine named in /__meta, through Fastify's own view plugin ---------

// rb:wiring template.*
// EJS is the engine @fastify/view's own README leads with. Compiled on first render and
// cached by the plugin, rendered per request: a precomputed string would measure nothing.
// `options` goes to ejs.compile. EJS compiles line tracking into the template for its error
// messages unless compileDebug is false.
app.register(view, { engine: { ejs }, root: VIEWS, options: { compileDebug: false } });
app.get("/template/small",  (_, reply) => reply.view("items.ejs", d.payload("small")));
app.get("/template/medium", (_, reply) => reply.view("items.ejs", d.payload("medium")));

// rb:handler errors.unmatched
app.setNotFoundHandler((_, reply) => reply.code(404).send({ error: "not_found" }));
// Fastify's own error envelope for anything it raised itself, which is what a failed schema
// and an unparseable body both are. Only a genuine bug falls through to the 500.
// rb:wiring errors.*
app.setErrorHandler((err, _, reply) =>
  err.statusCode
    ? reply.code(err.statusCode).send({
        statusCode: err.statusCode, code: err.code,
        error: err.statusCode >= 500 ? "Internal Server Error" : "Bad Request",
        message: err.message,
      })
    : reply.code(500).send({ error: "internal", message: err.message }));

export { app };
export const listen = (port) => app.listen({ port, host: "0.0.0.0" });

export async function handler(req, res) {
  await app.ready();
  app.routing(req, res);
}
