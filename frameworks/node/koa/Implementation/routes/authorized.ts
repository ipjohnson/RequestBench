import type { Context, Middleware, Next } from "koa";

import type { Routes } from "../app.ts";

// rb:wiring authorized.*
/**
 * The token check, as route middleware in front of the handler. ctx.assert throws Koa's 403 for any
 * other token, and Koa's error handling writes it, so the handler never runs.
 */
function requireToken(token: string): Middleware {
  const accepted = `Bearer ${token}`;
  // ctx is annotated because TypeScript accepts a call to an assertion such as ctx.assert only
  // through a name declared with a type.
  return async (ctx: Context, next: Next) => {
    ctx.assert(ctx.get("authorization") === accepted, 403);
    await next();
  };
}
// rb:end

/** authorized: Koa has no authorization of its own, and the Koa organisation publishes none for a bearer token, so the check is route middleware. */
const authorized: Routes = (router, { payloads: p }) => {
  router.get("/authorized/small", requireToken(p.settings.token), (ctx) => {
    ctx.body = p.small;
  });
};

export default authorized;
