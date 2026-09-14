// RequestBench target: Hono. Framework wiring only; behaviour from _shared/domain.js.
import { Hono } from "hono";
import { serve, getRequestListener } from "@hono/node-server";
import { pkgVersion } from "../_shared/version.js";
import { hostMeta } from "../_shared/host.js";
import * as d from "../_shared/domain.js";

const meta = { framework: "hono", version: pkgVersion("hono"),
               runtime: "node " + process.versions.node };

const app = new Hono();
const send = (c, v, status = 200) =>
  v === d.NOT_FOUND ? c.json({ error: "not_found" }, 404) : c.json(v, status);

app.get("/plaintext", (c) => c.text("Hello, World!"));
app.get("/health", (c) => c.text("ok"));
app.get("/__meta", (c) => c.json({ ...meta, ...hostMeta() }));
app.get("/json/small", (c) => c.json(d.jsonSmall()));

app.get("/products", (c) => c.json(d.listProducts(c.req.query())));
app.get("/customers", (c) => c.json(d.listCustomers(c.req.query())));
app.get("/orders", (c) => c.json(d.listOrders(c.req.query())));
app.get("/search", (c) => c.json(d.search(c.req.query())));
app.get("/dashboard", (c) => c.json(d.dashboard()));
app.get("/boom", () => { throw new d.Boom(); });
app.get("/forbidden", (c) => c.json({ error: "forbidden" }, 403));

app.get("/products/:pid", (c) => send(c, d.getProduct(c.req.param("pid"))));
app.get("/customers/:cid", (c) => send(c, d.getCustomer(c.req.param("cid"))));
app.get("/orders/:oid", (c) => send(c, d.getOrder(c.req.param("oid"))));
app.get("/products/:pid/reviews", (c) => send(c, d.getProductReviews(c.req.param("pid"))));
app.get("/products/:pid/related", (c) => send(c, d.relatedProducts(c.req.param("pid"))));
app.get("/customers/:cid/orders", (c) => send(c, d.getCustomerOrders(c.req.param("cid"))));
app.get("/customers/:cid/summary", (c) => send(c, d.customerSummary(c.req.param("cid"))));
app.get("/orders/:oid/lines", (c) => send(c, d.getOrderLines(c.req.param("oid"))));
app.get("/orders/:oid/full", (c) => send(c, d.orderFull(c.req.param("oid"))));
app.get("/regions/:r/customers", (c) => send(c, d.getRegionCustomers(c.req.param("r"))));
app.get("/regions/:r/report", (c) => send(c, d.regionReport(c.req.param("r"))));
app.get("/customers/:cid/orders/:oid", (c) =>
  send(c, d.getCustomerOrder(c.req.param("cid"), c.req.param("oid"))));
app.get("/orders/:oid/lines/:lid", (c) =>
  send(c, d.getOrderLine(c.req.param("oid"), c.req.param("lid"))));
app.get("/regions/:r/customers/:cid/orders/:oid/lines/:lid", (c) =>
  send(c, d.getOrderLine(c.req.param("oid"), c.req.param("lid"))));

const body = async (c) => {
  try { return await c.req.json(); }
  catch { throw new d.ValidationError([{ field: "body", rule: "json" }]); }
};
app.post("/orders/validate",    async (c) => c.json(d.validateOrder(await body(c))));
app.post("/customers/validate", async (c) => c.json(d.validateCustomer(await body(c))));
app.post("/products/validate",  async (c) => c.json(d.validateProduct(await body(c))));
app.post("/echo",               async (c) => c.json(d.echo(await body(c))));
app.post("/orders", async (c) => {
  const v = d.validateOrder(await body(c));
  c.header("location", "/orders/" + d.NEXT_ORDER_ID);
  return c.json(v, 201);
});
app.post("/orders/:oid/lines", async (c) => {
  const o = d.getOrder(c.req.param("oid"));
  if (o === d.NOT_FOUND) return c.json({ error: "not_found" }, 404);
  const line = d.validateLine(await body(c));
  c.header("location", `/orders/${c.req.param("oid")}/lines/${o.lines.length + 1}`);
  return c.json(line, 201);
});
app.put("/orders/:oid", async (c) => {
  const o = d.getOrder(c.req.param("oid"));
  if (o === d.NOT_FOUND) return c.json({ error: "not_found" }, 404);
  return c.json({ id: o.id, ...d.validateOrder(await body(c)) });
});
app.patch("/customers/:cid", async (c) =>
  send(c, d.patchCustomer(c.req.param("cid"), await body(c))));
app.delete("/orders/:oid/lines/:lid", (c) => {
  if (d.getOrderLine(c.req.param("oid"), c.req.param("lid")) === d.NOT_FOUND)
    return c.json({ error: "not_found" }, 404);
  return c.body(null, 204);
});

app.notFound((c) => c.json({ error: "not_found" }, 404));
app.onError((err, c) =>
  err instanceof d.ValidationError
    ? c.json({ error: "validation_failed", errors: err.errors }, 422)
    : c.json({ error: "internal", message: err.message }, 500));

export { app };
export const handler = getRequestListener(app.fetch);
export const listen = (port) => new Promise((r) => serve({ fetch: app.fetch, port }, r));
