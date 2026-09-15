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
import compress from "@fastify/compress";
import view from "@fastify/view";
import handlebars from "handlebars";
import { pkgVersion } from "../_shared/version.js";
import { hostMeta } from "../_shared/host.js";
import { VIEWS } from "../_shared/template.js";
import * as d from "../_shared/domain.js";

const meta = { framework: "fastify", version: pkgVersion("fastify"),
               runtime: "node " + process.versions.node, template: "handlebars" };

const app = Fastify({ logger: false, disableRequestLogging: true });

// Same reason as the baseline: when a function host has already parsed the body, Fastify
// must not try to read the stream again. Its own parser still runs under `container`.
app.addContentTypeParser("application/json", (req, payload, done) => {
  if (req.raw.body !== undefined) return done(null, req.raw.body);
  let data = "";
  payload.on("data", (c) => (data += c));
  payload.on("end", () => {
    try { done(null, data.length ? JSON.parse(data) : undefined); }
    catch { done(new d.ValidationError([{ field: "body", rule: "json" }])); }
  });
});

const send = (reply, v, status = 200) =>
  v === d.NOT_FOUND ? reply.code(404).send({ error: "not_found" }) : reply.code(status).send(v);
const small = () => d.payload("small");

// ---- baseline, json, parameters, query, headers, middleware --------------------------

app.get("/plaintext", (_, reply) => reply.type("text/plain").send("Hello, World!"));
app.get("/health",    (_, reply) => reply.type("text/plain").send("ok"));
app.get("/__meta",    () => ({ ...meta, ...hostMeta() }));

app.get("/json/small",  () => d.payload("small"));
app.get("/json/medium", () => d.payload("medium"));
app.get("/json/large",  () => d.payload("large"));

app.get("/parameters/static/segment/literal", small);
app.get("/parameters/:one", small);
app.get("/parameters/:one/with-second/:two", small);

app.get("/query/one",  (req) => d.coerceOne(req.query));
app.get("/query/many", (req) => d.coerceMany(req.query));

// The handler reads no header at all, so headers.many minus headers.few is the cost of
// materialising 27 nobody asked for.
app.get("/headers", small);

// Fastify's middleware is its hooks, and a route-level hook array is how you scope them to
// one route. Each layer calls done() and does nothing else.
const noop = (_req, _reply, done) => done();
const layers = (n) => Array.from({ length: n }, () => noop);
app.get("/middleware/none", small);
app.get("/middleware/four", { onRequest: layers(4) }, small);
app.get("/middleware/sixteen", { onRequest: layers(16) }, small);

// ---- authorized: a route-scoped onRequest hook, not an if in the handler --------------

const requireToken = (req, reply, done) => {
  if (d.tokenOk(req.headers.authorization)) return done();
  reply.code(403).send({ error: "forbidden" });
};
app.get("/authorized/small", { onRequest: requireToken }, small);

// ---- compressed: @fastify/compress, registered in its own encapsulated scope ----------

// rb:snippet compressed.identity_small compressed.identity_medium compressed.identity_large
// rb:snippet compressed.gzip_small compressed.gzip_medium compressed.gzip_large
app.register(async (scope) => {
  // Threshold is left at the plugin's own default. Whether a framework bothers to compress
  // a body too small to benefit is one of the things compressed.small is there to show, so
  // forcing it here would erase the answer.
  await scope.register(compress, {
    encodings: ["gzip"], zlibOptions: { level: d.GZIP_LEVEL },
  });
  for (const size of ["small", "medium", "large"])
    scope.get("/compressed/" + size, (_, reply) =>
      reply.header("x-rb-serial", d.nextSerial()).send(d.payload(size)));
});

// ---- cached: validator headers and the conditional, scoped the same way ---------------

// The ETag is pinned in the fixture, so this measures emitting the header and comparing it
// rather than hashing the body. @fastify/etag would compute its own and could not produce
// the pinned value, which is why the hook is written out.
//
// The size is closed over per route rather than sliced back out of req.url, which carries
// the query string: /cached/large?x=1 looked up a payload named "large?x=1" and threw.
const validators = (size) => {
  const etag = d.etagOf(size);
  return (req, reply, done) => {
    reply.header("etag", etag).header("cache-control", "public, max-age=60")
         .header("x-rb-serial", d.nextSerial());
    if (req.headers["if-none-match"] === etag) return reply.code(304).send();
    done();
  };
};
// rb:snippet cached.small cached.medium cached.large cached.revalidate
app.register(async (scope) => {
  for (const size of ["small", "medium", "large"])
    scope.get("/cached/" + size, { onRequest: validators(size) }, () => d.payload(size));
});

// ---- body: bind, validate, and the two rejection contracts ---------------------------

app.post("/body/bind/small",  (req) => d.bindEcho(req.body));
app.post("/body/bind/medium", (req) => d.bindEcho(req.body));
app.post("/body/validate/small",  (req) => d.validateOrder(req.body));
app.post("/body/validate/medium", (req) => d.validateOrder(req.body));
app.post("/body/validate/first-error", (req) => d.validateOrder(req.body, true));

// ---- domain --------------------------------------------------------------------------

app.get("/domain/orders", (req) => d.domainFilter(req.query));
app.get("/domain/orders/:oid", (req, reply) => send(reply, d.getOrder(req.params.oid)));
app.get("/domain/customers/:cid/summary", (req, reply) => send(reply, d.domainJoin(req.params.cid)));
app.get("/domain/regions/:r/report", (req, reply) => send(reply, d.domainAggregate(req.params.r)));
app.post("/domain/orders", (req, reply) =>
  reply.code(201).header("location", "/domain/orders/" + d.NEXT_ORDER_ID)
       .send(d.validateOrder(req.body)));
app.put("/domain/orders/:oid", (req, reply) =>
  d.getOrder(req.params.oid) === d.NOT_FOUND
    ? reply.code(404).send({ error: "not_found" })
    : reply.send({ id: Number(req.params.oid), ...d.validateOrder(req.body) }));
app.patch("/domain/customers/:cid", (req, reply) =>
  send(reply, d.patchCustomer(req.params.cid, req.body)));
app.delete("/domain/orders/:oid/lines/:lid", (req, reply) =>
  d.getOrderLine(req.params.oid, req.params.lid) === d.NOT_FOUND
    ? reply.code(404).send({ error: "not_found" })
    : reply.code(204).send());

// ---- template: the engine named in /__meta, through Fastify's own view plugin ---------

app.register(view, { engine: { handlebars }, root: VIEWS });
app.get("/template/small",  (_, reply) => reply.view("items.hbs", d.payload("small")));
app.get("/template/medium", (_, reply) => reply.view("items.hbs", d.payload("medium")));

// rb:snippet errors.unmatched
app.setNotFoundHandler((_, reply) => reply.code(404).send({ error: "not_found" }));
app.setErrorHandler((err, _, reply) =>
  err instanceof d.ValidationError
    ? reply.code(422).send({ error: "validation_failed", errors: err.errors })
    : reply.code(500).send({ error: "internal", message: err.message }));

export { app };
export const listen = (port) => app.listen({ port, host: "0.0.0.0" });

export async function handler(req, res) {
  await app.ready();
  app.routing(req, res);
}
