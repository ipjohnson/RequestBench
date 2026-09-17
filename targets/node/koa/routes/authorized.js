// authorized: the framework's authorization mechanism, crypto excluded.
//
// Route-scoped middleware, not an if in the handler. An if would measure the language;
// the point of the family is the framework's own plumbing.
import * as d from "../../_shared/domain.js";

// rb:wiring authorized.*
const requireToken = async (ctx, next) => {
  if (!d.tokenOk(ctx.headers.authorization)) {
    ctx.status = 403;
    ctx.body = d.forbiddenBody();
    return;
  }
  await next();
};

export default function authorized(router) {
  router.get("/authorized/small", requireToken, (ctx) => { ctx.body = d.payload("small"); });
}
