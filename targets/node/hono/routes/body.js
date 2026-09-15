// body: the parser and the validator, with size crossed against validation.
//
// bind parses and binds without validating, so validate minus bind is the validator alone
// rather than the validator plus the parse.
import * as d from "../../_shared/domain.js";

export default function body(app) {
  app.post("/body/bind/small", async (c) => c.json(d.bindEcho(await c.req.json())));

  app.post("/body/bind/medium", async (c) => c.json(d.bindEcho(await c.req.json())));

  app.post("/body/validate/small", async (c) => c.json(d.validateOrder(await c.req.json())));

  app.post("/body/validate/medium", async (c) => c.json(d.validateOrder(await c.req.json())));

  app.post("/body/validate/first-error", async (c) =>
    c.json(d.validateOrder(await c.req.json(), true)));
}
