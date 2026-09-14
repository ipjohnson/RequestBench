// RequestBench target: h3 v2. Behaviour from _shared/domain.js.
import { H3, toNodeHandler, serve } from "h3";
import { pkgVersion } from "../_shared/version.js";
import * as d from "../_shared/domain.js";

const meta = { framework: "h3", version: pkgVersion("h3"),
               runtime: "node " + process.versions.node };

// h3 v2 takes the error handler on the constructor; assigning app.onError afterwards is
// silently ignored, which showed up as 500s where the contract says 422.
const app = new H3({
  onError(wrapped, e) {
    // h3 v2 wraps a thrown error in HTTPError and puts the original on .cause, so the
    // instanceof check has to look through it or every validation failure reads as a 500.
    const err = wrapped?.cause instanceof Error ? wrapped.cause : wrapped;
    if (err instanceof d.ValidationError) {
      e.res.status = 422;
      return { error: "validation_failed", errors: err.errors };
    }
    e.res.status = 500;
    return { error: "internal", message: err.message };
  },
});
const P = (e, k) => e.context.params[k];
const Q = (e) => Object.fromEntries(e.url.searchParams);

const json = (e, v, status = 200) => { e.res.status = status; return v; };
const notFound = (e) => json(e, { error: "not_found" }, 404);
const send = (e, v, status = 200) =>
  v === d.NOT_FOUND ? notFound(e) : json(e, v, status);

app.get("/plaintext", (e) => { e.res.headers.set("content-type", "text/plain"); return "Hello, World!"; });
app.get("/health", (e) => { e.res.headers.set("content-type", "text/plain"); return "ok"; });
app.get("/__meta", () => meta);
app.get("/json/small", () => d.jsonSmall());

app.get("/products", (e) => d.listProducts(Q(e)));
app.get("/customers", (e) => d.listCustomers(Q(e)));
app.get("/orders", (e) => d.listOrders(Q(e)));
app.get("/search", (e) => d.search(Q(e)));
app.get("/dashboard", () => d.dashboard());
app.get("/boom", () => { throw new d.Boom(); });
app.get("/forbidden", (e) => json(e, { error: "forbidden" }, 403));

app.get("/products/:pid", (e) => send(e, d.getProduct(P(e, "pid"))));
app.get("/customers/:cid", (e) => send(e, d.getCustomer(P(e, "cid"))));
app.get("/orders/:oid", (e) => send(e, d.getOrder(P(e, "oid"))));
app.get("/products/:pid/reviews", (e) => send(e, d.getProductReviews(P(e, "pid"))));
app.get("/products/:pid/related", (e) => send(e, d.relatedProducts(P(e, "pid"))));
app.get("/customers/:cid/orders", (e) => send(e, d.getCustomerOrders(P(e, "cid"))));
app.get("/customers/:cid/summary", (e) => send(e, d.customerSummary(P(e, "cid"))));
app.get("/orders/:oid/lines", (e) => send(e, d.getOrderLines(P(e, "oid"))));
app.get("/orders/:oid/full", (e) => send(e, d.orderFull(P(e, "oid"))));
app.get("/regions/:r/customers", (e) => send(e, d.getRegionCustomers(P(e, "r"))));
app.get("/regions/:r/report", (e) => send(e, d.regionReport(P(e, "r"))));
app.get("/customers/:cid/orders/:oid", (e) =>
  send(e, d.getCustomerOrder(P(e, "cid"), P(e, "oid"))));
app.get("/orders/:oid/lines/:lid", (e) =>
  send(e, d.getOrderLine(P(e, "oid"), P(e, "lid"))));
app.get("/regions/:r/customers/:cid/orders/:oid/lines/:lid", (e) =>
  send(e, d.getOrderLine(P(e, "oid"), P(e, "lid"))));

async function body(e) {
  // A function host may have parsed the body already; the raw node request carries it.
  if (e.req?.node?.req?.body !== undefined) return e.req.node.req.body;
  try { return await e.req.json(); }
  catch { throw new d.ValidationError([{ field: "body", rule: "json" }]); }
}
app.post("/orders/validate", async (e) => d.validateOrder(await body(e)));
app.post("/customers/validate", async (e) => d.validateCustomer(await body(e)));
app.post("/products/validate", async (e) => d.validateProduct(await body(e)));
app.post("/echo", async (e) => d.echo(await body(e)));
app.post("/orders", async (e) => {
  const v = d.validateOrder(await body(e));
  e.res.headers.set("location", "/orders/" + d.NEXT_ORDER_ID);
  return json(e, v, 201);
});
app.post("/orders/:oid/lines", async (e) => {
  const o = d.getOrder(P(e, "oid"));
  if (o === d.NOT_FOUND) return notFound(e);
  const line = d.validateLine(await body(e));
  e.res.headers.set("location", `/orders/${P(e, "oid")}/lines/${o.lines.length + 1}`);
  return json(e, line, 201);
});
app.put("/orders/:oid", async (e) => {
  const o = d.getOrder(P(e, "oid"));
  if (o === d.NOT_FOUND) return notFound(e);
  return { id: o.id, ...d.validateOrder(await body(e)) };
});
app.patch("/customers/:cid", async (e) =>
  send(e, d.patchCustomer(P(e, "cid"), await body(e))));
app.delete("/orders/:oid/lines/:lid", (e) => {
  if (d.getOrderLine(P(e, "oid"), P(e, "lid")) === d.NOT_FOUND) return notFound(e);
  e.res.status = 204;
  return null;
});

app.all("/**", (e) => notFound(e));
export { app };
export const handler = toNodeHandler(app);
export const listen = (port) => new Promise((r) => r(serve(app, { port })));
