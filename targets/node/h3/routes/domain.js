// domain: application-shaped handler work and the write methods.
import { getRouterParam, getValidatedQuery, noContent, readBody } from "h3";

import * as d from "../../_shared/domain.js";
import { checkOrder, orderOf, refused } from "../validation.js";
import { filter } from "./query.js";

// A write validates the same way body.validate_* does, because it is the same walk.
const written = async (e) => {
  const body = await readBody(e);
  const errs = checkOrder(body, false);
  if (!errs.length) return { body };
  e.res.status = 422;
  return { errs: refused(errs) };
};

const send = (e, v, status = 200) => {
  if (v === d.NOT_FOUND) {
    e.res.status = 404;
    return d.notFoundBody();
  }
  e.res.status = status;
  return v;
};

export default function domain(app) {
  app.get("/domain/orders", async (e) => {
    const q = await getValidatedQuery(e, filter);
    return d.domainFilter(q.page, q.size, q.status);
  });

  app.post("/domain/orders", async (e) => {
    e.res.headers.set("location", d.createdLocation());
    const v = await written(e);
    return v.errs ? v.errs : send(e, orderOf(v.body), 201);
  });

  app.get("/domain/orders/:oid", (e) => send(e, d.getOrder(getRouterParam(e, "oid"))));

  app.put("/domain/orders/:oid", async (e) => {
    const oid = getRouterParam(e, "oid");
    if (d.getOrder(oid) === d.NOT_FOUND) return send(e, d.NOT_FOUND);
    const v = await written(e);
    return v.errs ? v.errs : { id: Number(oid), ...orderOf(v.body) };
  });

  app.get("/domain/customers/:cid/summary", (e) =>
    send(e, d.domainJoin(getRouterParam(e, "cid"))));

  app.get("/domain/regions/:r/report", (e) =>
    send(e, d.domainAggregate(getRouterParam(e, "r"))));

  app.patch("/domain/customers/:cid", async (e) =>
    send(e, d.patchCustomer(getRouterParam(e, "cid"), await readBody(e))));

  app.delete("/domain/orders/:oid/lines/:lid", (e) => {
    const line = d.getOrderLine(getRouterParam(e, "oid"), getRouterParam(e, "lid"));
    return line === d.NOT_FOUND ? send(e, d.NOT_FOUND) : noContent();
  });
}
