// RequestBench target: Fastify. Framework wiring only; behaviour comes from _shared/domain.js.
//
// `listen` starts Fastify's own server, which is what people deploy. `handler` is
// Fastify's routing exposed as a plain (req, res), which is what a function host invokes.
import Fastify from "fastify";
import { pkgVersion } from "../_shared/version.js";
import * as d from "../_shared/domain.js";

const meta = { framework: "fastify", version: pkgVersion("fastify"),
               runtime: "node " + process.versions.node };

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

app.get("/plaintext", (_, reply) => reply.type("text/plain").send("Hello, World!"));
app.get("/health",    (_, reply) => reply.type("text/plain").send("ok"));
app.get("/json/small", () => d.jsonSmall());
app.get("/__meta", () => meta);

app.get("/products",  (req) => d.listProducts(req.query));
app.get("/customers", (req) => d.listCustomers(req.query));
app.get("/orders",    (req) => d.listOrders(req.query));
app.get("/search",    (req) => d.search(req.query));
app.get("/dashboard", () => d.dashboard());
app.get("/boom", () => { throw new d.Boom(); });
app.get("/forbidden", (_, reply) => reply.code(403).send({ error: "forbidden" }));

app.get("/products/:pid",  (req, reply) => send(reply, d.getProduct(req.params.pid)));
app.get("/customers/:cid", (req, reply) => send(reply, d.getCustomer(req.params.cid)));
app.get("/orders/:oid",    (req, reply) => send(reply, d.getOrder(req.params.oid)));

app.get("/products/:pid/reviews",  (req, reply) => send(reply, d.getProductReviews(req.params.pid)));
app.get("/products/:pid/related",  (req, reply) => send(reply, d.relatedProducts(req.params.pid)));
app.get("/customers/:cid/orders",  (req, reply) => send(reply, d.getCustomerOrders(req.params.cid)));
app.get("/customers/:cid/summary", (req, reply) => send(reply, d.customerSummary(req.params.cid)));
app.get("/orders/:oid/lines",      (req, reply) => send(reply, d.getOrderLines(req.params.oid)));
app.get("/orders/:oid/full",       (req, reply) => send(reply, d.orderFull(req.params.oid)));
app.get("/regions/:r/customers",   (req, reply) => send(reply, d.getRegionCustomers(req.params.r)));
app.get("/regions/:r/report",      (req, reply) => send(reply, d.regionReport(req.params.r)));

app.get("/customers/:cid/orders/:oid", (req, reply) =>
  send(reply, d.getCustomerOrder(req.params.cid, req.params.oid)));
app.get("/orders/:oid/lines/:lid", (req, reply) =>
  send(reply, d.getOrderLine(req.params.oid, req.params.lid)));
app.get("/regions/:r/customers/:cid/orders/:oid/lines/:lid", (req, reply) =>
  send(reply, d.getOrderLine(req.params.oid, req.params.lid)));

app.post("/orders/validate",    (req) => d.validateOrder(req.body));
app.post("/customers/validate", (req) => d.validateCustomer(req.body));
app.post("/products/validate",  (req) => d.validateProduct(req.body));
app.post("/echo",               (req) => d.echo(req.body));
app.post("/orders", (req, reply) =>
  reply.code(201).header("location", "/orders/" + d.NEXT_ORDER_ID).send(d.validateOrder(req.body)));
app.post("/orders/:oid/lines", (req, reply) => {
  const o = d.getOrder(req.params.oid);
  if (o === d.NOT_FOUND) return reply.code(404).send({ error: "not_found" });
  return reply.code(201)
    .header("location", `/orders/${req.params.oid}/lines/${o.lines.length + 1}`)
    .send(d.validateLine(req.body));
});
app.put("/orders/:oid", (req, reply) =>
  d.getOrder(req.params.oid) === d.NOT_FOUND
    ? reply.code(404).send({ error: "not_found" })
    : reply.send({ id: Number(req.params.oid), ...d.validateOrder(req.body) }));
app.patch("/customers/:cid", (req, reply) =>
  send(reply, d.patchCustomer(req.params.cid, req.body)));
app.delete("/orders/:oid/lines/:lid", (req, reply) =>
  d.getOrderLine(req.params.oid, req.params.lid) === d.NOT_FOUND
    ? reply.code(404).send({ error: "not_found" })
    : reply.code(204).send());

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
