import type { MiddlewareHandler } from "hono";

import type { Routes } from "../app.ts";

// rb:wiring middleware.*
/**
 * Middleware is Hono's layer in front of a handler, and a route takes middleware of its own before
 * its handler, so these run on one route and no other.
 */
const noop: MiddlewareHandler = async (_c, next) => {
  await next();
};

/** `count` no-op layers. The first is written out, because Hono's types take a spread of handlers only when one is certain to be there. */
const layers = (count: number) => [noop, ...Array.from({ length: count - 1 }, () => noop)] as const;
// rb:end

/** middleware: no-op layers in front of the handler. */
const middleware: Routes = (app, p) => {
  app.get("/middleware/none", (c) => c.json(p.small));

  app.get("/middleware/four", ...layers(4), (c) => c.json(p.small));

  app.get("/middleware/sixteen", ...layers(16), (c) => c.json(p.small));
};

export default middleware;
