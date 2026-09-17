// body: the parser and the validator, with size crossed against validation.
//
// koa-bodyparser is mounted on these five routes rather than on the application. On the
// application it would look for a body on all forty-five endpoints, including the
// thirty-eight that never send one.
//
// bind parses and binds without validating, so validate minus bind is the validator alone
// rather than the validator plus the parse. Koa has no validation layer, so the walk this
// target holds in validation.js is what runs, in the handler.
// rb:wiring body.*
import bodyParser from "koa-bodyparser";

import * as d from "../../_shared/domain.js";
import { checkOrder, orderOf, refused } from "../validation.js";

// rb:wiring body.*
const parse = bodyParser({ jsonLimit: "4mb" });

// rb:wiring body.*
const validated = (firstError) => (ctx) => {
  const errs = checkOrder(ctx.request.body, firstError);
  if (errs.length) {
    ctx.status = 422;
    ctx.body = refused(errs);
    return;
  }
  ctx.body = orderOf(ctx.request.body);
};

export default function body(router) {
  router.post("/body/bind/small", parse, (ctx) => { ctx.body = d.bindEcho(ctx.request.body); });

  router.post("/body/bind/medium", parse, (ctx) => { ctx.body = d.bindEcho(ctx.request.body); });

  router.post("/body/validate/small", parse, validated(false));

  router.post("/body/validate/medium", parse, validated(false));

  router.post("/body/validate/first-error", parse, validated(true));
}
