import type { Middleware } from "h3";

import type { Routes } from "../app.ts";

// rb:wiring middleware.*
/**
 * h3 takes middleware in a route's options and runs it on that route alone, before the handler.
 * Each layer calls the next and does nothing else.
 */
const noop: Middleware = (_event, next) => next();

const layers = (count: number): Middleware[] => Array.from({ length: count }, () => noop);
// rb:end

/** middleware: no-op layers in front of the handler. */
const middleware: Routes = (app, p) => {
  app.get("/middleware/none", () => p.small);

  app.get("/middleware/four", () => p.small, { middleware: layers(4) });

  app.get("/middleware/sixteen", () => p.small, { middleware: layers(16) });
};

export default middleware;
