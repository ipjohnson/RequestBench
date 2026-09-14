// RequestBench target: Koa with @koa/router. Behaviour from _shared/domain.js.
import Koa from "koa";
import Router from "@koa/router";
import bodyParser from "koa-bodyparser";
import { pkgVersion } from "../_shared/version.js";
import { hostMeta } from "../_shared/host.js";
import * as d from "../_shared/domain.js";

const meta = { framework: "koa", version: pkgVersion("koa"),
               runtime: "node " + process.versions.node };

const app = new Koa();
app.silent = true;
const router = new Router();

// Koa answers 404 with an empty body by default, and an unhandled throw with plain text.
// One middleware gives both the shape every other target produces.
app.use(async (ctx, next) => {
  try {
    await next();
    if (ctx.status === 404 && ctx.body === undefined) {
      ctx.status = 404;
      ctx.body = { error: "not_found" };
    }
  } catch (err) {
    if (err instanceof d.ValidationError) {
      ctx.status = 422;
      ctx.body = { error: "validation_failed", errors: err.errors };
    } else {
      ctx.status = 500;
      ctx.body = { error: "internal", message: err.message };
    }
  }
});

// A function host parses the body first and hands over a consumed stream; take what it
// already produced rather than waiting on "end" forever.
app.use(async (ctx, next) => {
  if (ctx.req.body !== undefined) {
    ctx.request.body = ctx.req.body;
    return next();
  }
  return bodyParser({ enableTypes: ["json"] })(ctx, next);
});

const send = (ctx, v, status = 200) => {
  if (v === d.NOT_FOUND) { ctx.status = 404; ctx.body = { error: "not_found" }; return; }
  ctx.status = status; ctx.body = v;
};

router.get("/plaintext", (ctx) => { ctx.type = "text/plain"; ctx.body = "Hello, World!"; });
router.get("/health", (ctx) => { ctx.type = "text/plain"; ctx.body = "ok"; });
router.get("/__meta", (ctx) => { ctx.body = { ...meta, ...hostMeta() }; });
router.get("/json/small", (ctx) => { ctx.body = d.jsonSmall(); });

router.get("/products", (ctx) => { ctx.body = d.listProducts(ctx.query); });
router.get("/customers", (ctx) => { ctx.body = d.listCustomers(ctx.query); });
router.get("/orders", (ctx) => { ctx.body = d.listOrders(ctx.query); });
router.get("/search", (ctx) => { ctx.body = d.search(ctx.query); });
router.get("/dashboard", (ctx) => { ctx.body = d.dashboard(); });
router.get("/boom", () => { throw new d.Boom(); });
router.get("/forbidden", (ctx) => { ctx.status = 403; ctx.body = { error: "forbidden" }; });

router.get("/products/:pid", (ctx) => send(ctx, d.getProduct(ctx.params.pid)));
router.get("/customers/:cid", (ctx) => send(ctx, d.getCustomer(ctx.params.cid)));
router.get("/orders/:oid", (ctx) => send(ctx, d.getOrder(ctx.params.oid)));
router.get("/products/:pid/reviews", (ctx) => send(ctx, d.getProductReviews(ctx.params.pid)));
router.get("/products/:pid/related", (ctx) => send(ctx, d.relatedProducts(ctx.params.pid)));
router.get("/customers/:cid/orders", (ctx) => send(ctx, d.getCustomerOrders(ctx.params.cid)));
router.get("/customers/:cid/summary", (ctx) => send(ctx, d.customerSummary(ctx.params.cid)));
router.get("/orders/:oid/lines", (ctx) => send(ctx, d.getOrderLines(ctx.params.oid)));
router.get("/orders/:oid/full", (ctx) => send(ctx, d.orderFull(ctx.params.oid)));
router.get("/regions/:r/customers", (ctx) => send(ctx, d.getRegionCustomers(ctx.params.r)));
router.get("/regions/:r/report", (ctx) => send(ctx, d.regionReport(ctx.params.r)));
router.get("/customers/:cid/orders/:oid", (ctx) =>
  send(ctx, d.getCustomerOrder(ctx.params.cid, ctx.params.oid)));
router.get("/orders/:oid/lines/:lid", (ctx) =>
  send(ctx, d.getOrderLine(ctx.params.oid, ctx.params.lid)));
router.get("/regions/:r/customers/:cid/orders/:oid/lines/:lid", (ctx) =>
  send(ctx, d.getOrderLine(ctx.params.oid, ctx.params.lid)));

const body = (ctx) => ctx.request.body;
router.post("/orders/validate", (ctx) => { ctx.body = d.validateOrder(body(ctx)); });
router.post("/customers/validate", (ctx) => { ctx.body = d.validateCustomer(body(ctx)); });
router.post("/products/validate", (ctx) => { ctx.body = d.validateProduct(body(ctx)); });
router.post("/echo", (ctx) => { ctx.body = d.echo(body(ctx)); });
router.post("/orders", (ctx) => {
  const v = d.validateOrder(body(ctx));
  ctx.set("location", "/orders/" + d.NEXT_ORDER_ID);
  ctx.status = 201; ctx.body = v;
});
router.post("/orders/:oid/lines", (ctx) => {
  const o = d.getOrder(ctx.params.oid);
  if (o === d.NOT_FOUND) { ctx.status = 404; ctx.body = { error: "not_found" }; return; }
  const line = d.validateLine(body(ctx));
  ctx.set("location", `/orders/${ctx.params.oid}/lines/${o.lines.length + 1}`);
  ctx.status = 201; ctx.body = line;
});
router.put("/orders/:oid", (ctx) => {
  const o = d.getOrder(ctx.params.oid);
  if (o === d.NOT_FOUND) { ctx.status = 404; ctx.body = { error: "not_found" }; return; }
  ctx.body = { id: o.id, ...d.validateOrder(body(ctx)) };
});
router.patch("/customers/:cid", (ctx) =>
  send(ctx, d.patchCustomer(ctx.params.cid, body(ctx))));
router.delete("/orders/:oid/lines/:lid", (ctx) => {
  if (d.getOrderLine(ctx.params.oid, ctx.params.lid) === d.NOT_FOUND) {
    ctx.status = 404; ctx.body = { error: "not_found" }; return;
  }
  ctx.status = 204;
});

app.use(router.routes()).use(router.allowedMethods());

export { app };
export const handler = app.callback();
export const listen = (port) => new Promise((r) => r(app.listen(port)));
