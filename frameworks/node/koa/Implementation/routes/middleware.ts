import type { Middleware } from "koa";

import type { Routes } from "../app.ts";

// rb:wiring middleware.*
/**
 * Koa's middleware is an async function that awaits next(), and @koa/router takes middleware in
 * front of a route's handler, so these run on one route and no other.
 */
const noop: Middleware = async (_ctx, next) => {
  await next();
};

const layers = (count: number) => Array.from({ length: count }, () => noop);
// rb:end

/** middleware: no-op layers in front of the handler. */
const middleware: Routes = (router, { payloads: p }) => {
  router.get("/middleware/none", (ctx) => {
    ctx.body = p.small;
  });

  router.get("/middleware/four", ...layers(4), (ctx) => {
    ctx.body = p.small;
  });

  router.get("/middleware/sixteen", ...layers(16), (ctx) => {
    ctx.body = p.small;
  });
};

export default middleware;
