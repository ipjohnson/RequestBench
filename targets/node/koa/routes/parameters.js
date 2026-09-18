// parameters: router captures with segment depth held constant, bound as integers and echoed.
//
// A capture reaches ctx.params as the string the route matched. router.param is @koa/router's
// own hook for a named capture: the router runs it once the route matches and before the
// handler. The conversion is registered there, so each handler echoes ctx.params already
// converted. This is this target's copy on purpose, and nothing else imports this file.
import * as d from "../../_shared/domain.js";

// rb:wiring parameters.*
const int = (v) => { const n = Number(v); return Number.isInteger(n) ? n : 0; };

export default function parameters(router) {
  // rb:wiring parameters.*
  // One function per name: @koa/router runs a given param function once per request, so one
  // function registered for both would convert one and leave two a string.
  router.param("one", (value, ctx, next) => { ctx.params.one = int(value); return next(); });
  router.param("two", (value, ctx, next) => { ctx.params.two = int(value); return next(); });
  // rb:end

  // Registered ahead of the one-capture route, which also matches this path: the router runs
  // the matching routes in the order they were registered, and this one answers.
  router.get("/parameters/static/segment/literal", (ctx) => { ctx.body = d.payload("small"); });

  router.get("/parameters/:one/segment/literal", (ctx) => {
    ctx.body = d.withEcho("small", ctx.params);
  });

  router.get("/parameters/:one/with-second/:two", (ctx) => {
    ctx.body = d.withEcho("small", ctx.params);
  });
}
