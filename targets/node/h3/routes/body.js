// body: the parser and the validator, with size crossed against validation.
//
// bind parses and binds without validating, so validate minus bind is the validator alone
// rather than the validator plus the parse.
import { readBody } from "h3";

import * as d from "../../_shared/domain.js";

export default function body(app) {
  app.post("/body/bind/small", async (e) => d.bindEcho(await readBody(e)));

  app.post("/body/bind/medium", async (e) => d.bindEcho(await readBody(e)));

  app.post("/body/validate/small", async (e) => d.validateOrder(await readBody(e)));

  app.post("/body/validate/medium", async (e) => d.validateOrder(await readBody(e)));

  app.post("/body/validate/first-error", async (e) => d.validateOrder(await readBody(e), true));
}
