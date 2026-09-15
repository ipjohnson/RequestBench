// domain: application-shaped handler work and the write methods.
import bodyParser from "koa-bodyparser";

import * as d from "../../_shared/domain.js";

const parse = bodyParser({ jsonLimit: "4mb" });

const send = (ctx, v, status = 200) => {
  if (v === d.NOT_FOUND) {
    ctx.status = 404;
    ctx.body = d.notFoundBody();
    return;
  }
  ctx.status = status;
  ctx.body = v;
};

export default function domain(router) {
  router.get("/domain/orders", (ctx) => { ctx.body = d.domainFilter(ctx.query); });

  router.post("/domain/orders", parse, (ctx) => {
    ctx.set("location", d.createdLocation());
    ctx.status = 201;
    ctx.body = d.validateOrder(ctx.request.body);
  });

  router.get("/domain/orders/:oid", (ctx) => send(ctx, d.getOrder(ctx.params.oid)));

  router.put("/domain/orders/:oid", parse, (ctx) => {
    if (d.getOrder(ctx.params.oid) === d.NOT_FOUND) return send(ctx, d.NOT_FOUND);
    ctx.body = { id: Number(ctx.params.oid), ...d.validateOrder(ctx.request.body) };
  });

  router.get("/domain/customers/:cid/summary", (ctx) => send(ctx, d.domainJoin(ctx.params.cid)));

  router.get("/domain/regions/:r/report", (ctx) => send(ctx, d.domainAggregate(ctx.params.r)));

  router.patch("/domain/customers/:cid", parse, (ctx) =>
    send(ctx, d.patchCustomer(ctx.params.cid, ctx.request.body)));

  router.delete("/domain/orders/:oid/lines/:lid", (ctx) => {
    if (d.getOrderLine(ctx.params.oid, ctx.params.lid) === d.NOT_FOUND) {
      return send(ctx, d.NOT_FOUND);
    }
    ctx.status = 204;
  });
}
