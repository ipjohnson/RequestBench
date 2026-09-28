import type { Routes } from "../app.ts";

/**
 * parameters: router captures, each echoed back as an integer. @koa/router runs the matching
 * routes in the order they were registered, so each path is registered before the capturing
 * routes that also match it, and answers first. The three captures match every path here, so
 * they come last.
 */
const parameters: Routes = (router, { payloads: p }) => {
  // rb:wiring parameters.*
  // A capture reaches the route as the string it matched. router.param is @koa/router's hook for a
  // named capture, which runs once a route with it matches and before that route's middleware, so
  // each capture is converted there and kept on ctx.state, where Koa passes values between middleware.
  router.param("one", (value, ctx, next) => {
    ctx.state.one = Number(value);
    return next();
  });
  router.param("two", (value, ctx, next) => {
    ctx.state.two = Number(value);
    return next();
  });
  router.param("three", (value, ctx, next) => {
    ctx.state.three = Number(value);
    return next();
  });
  // rb:end

  router.get("/parameters/static/segment/literal", (ctx) => {
    ctx.body = p.small;
  });

  router.get("/parameters/:one/segment/literal", (ctx) => {
    ctx.body = { ...p.small, echo: { one: ctx.state.one } };
  });

  router.get("/parameters/:one/with-second/:two", (ctx) => {
    ctx.body = { ...p.small, echo: { one: ctx.state.one, two: ctx.state.two } };
  });

  router.get("/parameters/:one/:two/:three", (ctx) => {
    ctx.body = { ...p.small, echo: { one: ctx.state.one, two: ctx.state.two, three: ctx.state.three } };
  });
};

export default parameters;
