// body: the parser and the validator, with size crossed against validation.
//
// bind parses and binds without validating, so validate minus bind is the validator alone
// rather than the validator plus the parse. Validating runs through hono/validator, which
// is a route-level hook: Hono reads the body, hands it to the check, and short circuits if
// the check answers. The handler reads the value back with c.req.valid("json").
import * as d from "../../_shared/domain.js";
import { orderOf, validatesOrder } from "../validation.js";

export default function body(app) {
  app.post("/body/bind/small", async (c) => c.json(d.bindEcho(await c.req.json())));

  app.post("/body/bind/medium", async (c) => c.json(d.bindEcho(await c.req.json())));

  app.post("/body/validate/small", validatesOrder(), (c) => c.json(orderOf(c.req.valid("json"))));

  app.post("/body/validate/medium", validatesOrder(), (c) => c.json(orderOf(c.req.valid("json"))));

  app.post("/body/validate/first-error", validatesOrder(true),
    (c) => c.json(orderOf(c.req.valid("json"))));
}
