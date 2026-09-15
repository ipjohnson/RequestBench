// middleware: per-layer dispatch cost at 0, 4 and 16 no-op layers.
//
// @koa/router takes middleware inline on the route, which is the scoping the family needs.
// Each layer awaits next() and does nothing else.
import * as d from "../../_shared/domain.js";

const noop = async (_ctx, next) => { await next(); };

const layers = (n) => Array.from({ length: n }, () => noop);

const small = (ctx) => { ctx.body = d.payload("small"); };

export default function middleware(router) {
  router.get("/middleware/none", small);

  router.get("/middleware/four", ...layers(4), small);

  router.get("/middleware/sixteen", ...layers(16), small);
}
