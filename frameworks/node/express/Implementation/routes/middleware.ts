import type { NextFunction, Request, RequestHandler, Response } from "express";

import type { Routes } from "../app.ts";

// rb:wiring middleware.*
/**
 * A middleware function is Express's layer in front of a handler, and a route takes any number of
 * them in its handler list, so these run on one route and no other.
 */
function noop(_request: Request, _response: Response, next: NextFunction): void {
  next();
}

const layers = (count: number): RequestHandler[] => Array.from({ length: count }, () => noop);
// rb:end

/** middleware: no-op layers in front of the handler. */
const middleware: Routes = (app, p) => {
  app.get("/middleware/none", (_request, response) => response.json(p.small));

  app.get("/middleware/four", ...layers(4), (_request, response) => response.json(p.small));

  app.get("/middleware/sixteen", ...layers(16), (_request, response) => response.json(p.small));
};

export default middleware;
