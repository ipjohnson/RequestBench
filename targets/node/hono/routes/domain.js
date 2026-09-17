// domain: application-shaped handler work and the write methods.
import * as d from "../../_shared/domain.js";
import { orderOf, validatesOrder } from "../validation.js";
import { bindsFilter } from "./query.js";

const send = (c, v, status = 200) =>
  v === d.NOT_FOUND ? c.json(d.notFoundBody(), 404) : c.json(v, status);

export default function domain(app) {
  app.get("/domain/orders", bindsFilter, (c) => {
    const q = c.req.valid("query");
    return c.json(d.domainFilter(q.page, q.size, q.status));
  });

  // The validator hook has to be on the route for c.req.valid to have anything: Hono runs
  // it before the handler, and without it the handler is reading a value nothing produced.
  app.post("/domain/orders", validatesOrder(), (c) => {
    c.header("location", d.createdLocation());
    return c.json(orderOf(c.req.valid("json")), 201);
  });

  app.get("/domain/orders/:oid", (c) => send(c, d.getOrder(c.req.param("oid"))));

  app.put("/domain/orders/:oid", validatesOrder(), (c) => {
    const oid = c.req.param("oid");
    if (d.getOrder(oid) === d.NOT_FOUND) return c.json(d.notFoundBody(), 404);
    return c.json({ id: Number(oid), ...orderOf(c.req.valid("json")) });
  });

  app.get("/domain/customers/:cid/summary", (c) => send(c, d.domainJoin(c.req.param("cid"))));

  app.get("/domain/regions/:r/report", (c) => send(c, d.domainAggregate(c.req.param("r"))));

  app.patch("/domain/customers/:cid", async (c) =>
    send(c, d.patchCustomer(c.req.param("cid"), await c.req.json())));

  app.delete("/domain/orders/:oid/lines/:lid", (c) =>
    d.getOrderLine(c.req.param("oid"), c.req.param("lid")) === d.NOT_FOUND
      ? c.json(d.notFoundBody(), 404)
      : c.body(null, 204));
}
