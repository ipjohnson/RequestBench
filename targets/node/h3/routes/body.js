// body: the parser and the validator, with size crossed against validation.
//
// bind parses and binds without validating, so validate minus bind is the validator alone
// rather than the validator plus the parse. h3 has no validation layer, so the walk this
// target holds in validation.js is what runs, in the handler.
import { readBody } from "h3";

import * as d from "../../_shared/domain.js";
import { checkOrder, orderOf, refused } from "../validation.js";

// rb:wiring body.*
const validated = (firstError) => async (e) => {
  const body = await readBody(e);
  const errs = checkOrder(body, firstError);
  if (errs.length) {
    e.res.status = 422;
    return refused(errs);
  }
  return orderOf(body);
};

export default function body(app) {
  app.post("/body/bind/small", async (e) => d.bindEcho(await readBody(e)));

  app.post("/body/bind/medium", async (e) => d.bindEcho(await readBody(e)));

  app.post("/body/validate/small", validated(false));

  app.post("/body/validate/medium", validated(false));

  app.post("/body/validate/first-error", validated(true));
}
