// body: the parser and the validator, with size crossed against validation.
//
// koa-bodyparser is mounted on these five routes rather than on the application. On the
// application it would look for a body on all forty-five endpoints, including the
// thirty-eight that never send one.
//
// bind parses and binds without validating, so validate minus bind is the validator alone
// rather than the validator plus the parse.
import bodyParser from "koa-bodyparser";

import * as d from "../../_shared/domain.js";

const parse = bodyParser({ jsonLimit: "4mb" });

export default function body(router) {
  router.post("/body/bind/small", parse, (ctx) => { ctx.body = d.bindEcho(ctx.request.body); });

  router.post("/body/bind/medium", parse, (ctx) => { ctx.body = d.bindEcho(ctx.request.body); });

  router.post("/body/validate/small", parse, (ctx) => {
    ctx.body = d.validateOrder(ctx.request.body);
  });

  router.post("/body/validate/medium", parse, (ctx) => {
    ctx.body = d.validateOrder(ctx.request.body);
  });

  router.post("/body/validate/first-error", parse, (ctx) => {
    ctx.body = d.validateOrder(ctx.request.body, true);
  });
}
