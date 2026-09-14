// RequestBench target: Express 5. Framework wiring only; behaviour from _shared/domain.js.
//
// An Express app already is a (req, res) function, so the host handler is the app itself.
import express from "express";
import { pkgVersion } from "../_shared/version.js";
import { hostMeta } from "../_shared/host.js";
import * as d from "../_shared/domain.js";

const meta = { framework: "express", version: pkgVersion("express"),
               runtime: "node " + process.versions.node };

const app = express();
app.disable("x-powered-by");        // every production deployment does this
app.disable("etag");                // response hashing is not part of what we measure
app.use(express.json({ limit: "1mb" }));

const send = (res, v, status = 200) =>
  v === d.NOT_FOUND ? res.status(404).json({ error: "not_found" }) : res.status(status).json(v);

app.get("/plaintext", (_, res) => res.type("text/plain").send("Hello, World!"));
app.get("/health",    (_, res) => res.type("text/plain").send("ok"));
app.get("/json/small", (_, res) => res.json(d.jsonSmall()));
app.get("/__meta", (_, res) => res.json({ ...meta, ...hostMeta() }));

app.get("/products",  (req, res) => res.json(d.listProducts(req.query)));
app.get("/customers", (req, res) => res.json(d.listCustomers(req.query)));
app.get("/orders",    (req, res) => res.json(d.listOrders(req.query)));
app.get("/search",    (req, res) => res.json(d.search(req.query)));
app.get("/dashboard", (_, res) => res.json(d.dashboard()));
app.get("/boom", () => { throw new d.Boom(); });
app.get("/forbidden", (_, res) => res.status(403).json({ error: "forbidden" }));

app.get("/products/:pid",  (req, res) => send(res, d.getProduct(req.params.pid)));
app.get("/customers/:cid", (req, res) => send(res, d.getCustomer(req.params.cid)));
app.get("/orders/:oid",    (req, res) => send(res, d.getOrder(req.params.oid)));

app.get("/products/:pid/reviews",  (req, res) => send(res, d.getProductReviews(req.params.pid)));
app.get("/products/:pid/related",  (req, res) => send(res, d.relatedProducts(req.params.pid)));
app.get("/customers/:cid/orders",  (req, res) => send(res, d.getCustomerOrders(req.params.cid)));
app.get("/customers/:cid/summary", (req, res) => send(res, d.customerSummary(req.params.cid)));
app.get("/orders/:oid/lines",      (req, res) => send(res, d.getOrderLines(req.params.oid)));
app.get("/orders/:oid/full",       (req, res) => send(res, d.orderFull(req.params.oid)));
app.get("/regions/:r/customers",   (req, res) => send(res, d.getRegionCustomers(req.params.r)));
app.get("/regions/:r/report",      (req, res) => send(res, d.regionReport(req.params.r)));

app.get("/customers/:cid/orders/:oid", (req, res) =>
  send(res, d.getCustomerOrder(req.params.cid, req.params.oid)));
app.get("/orders/:oid/lines/:lid", (req, res) =>
  send(res, d.getOrderLine(req.params.oid, req.params.lid)));
app.get("/regions/:r/customers/:cid/orders/:oid/lines/:lid", (req, res) =>
  send(res, d.getOrderLine(req.params.oid, req.params.lid)));

app.post("/orders/validate",    (req, res) => res.json(d.validateOrder(req.body)));
app.post("/customers/validate", (req, res) => res.json(d.validateCustomer(req.body)));
app.post("/products/validate",  (req, res) => res.json(d.validateProduct(req.body)));
app.post("/echo",               (req, res) => res.json(d.echo(req.body)));
app.post("/orders", (req, res) =>
  res.status(201).location("/orders/" + d.NEXT_ORDER_ID).json(d.validateOrder(req.body)));
app.post("/orders/:oid/lines", (req, res) => {
  const o = d.getOrder(req.params.oid);
  if (o === d.NOT_FOUND) return res.status(404).json({ error: "not_found" });
  return res.status(201)
    .location(`/orders/${req.params.oid}/lines/${o.lines.length + 1}`)
    .json(d.validateLine(req.body));
});
app.put("/orders/:oid", (req, res) =>
  d.getOrder(req.params.oid) === d.NOT_FOUND
    ? res.status(404).json({ error: "not_found" })
    : res.json({ id: Number(req.params.oid), ...d.validateOrder(req.body) }));
app.patch("/customers/:cid", (req, res) =>
  send(res, d.patchCustomer(req.params.cid, req.body)));
app.delete("/orders/:oid/lines/:lid", (req, res) =>
  d.getOrderLine(req.params.oid, req.params.lid) === d.NOT_FOUND
    ? res.status(404).json({ error: "not_found" })
    : res.status(204).end());

app.use((_, res) => res.status(404).json({ error: "not_found" }));
app.use((err, _req, res, _next) =>
  err instanceof d.ValidationError
    ? res.status(422).json({ error: "validation_failed", errors: err.errors })
    : res.status(500).json({ error: "internal", message: err.message }));

export { app };
export const listen = (port) => new Promise((r) => r(app.listen(port)));
export const handler = app;
