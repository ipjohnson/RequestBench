// middleware: per-layer dispatch cost at 0, 4 and 16 no-op layers.
//
// Hono takes middleware inline on the route, which is the scoping the family needs. Each
// layer awaits next() and does nothing else.
import * as d from "../../_shared/domain.js";

// rb:wiring middleware.*
const noop = async (_c, next) => { await next(); };

// rb:wiring middleware.*
const layers = (n) => Array.from({ length: n }, () => noop);

// rb:wiring middleware.*
const small = (c) => c.json(d.payload("small"));

export default function middleware(app) {
  app.get("/middleware/none", small);

  app.get("/middleware/four", ...layers(4), small);

  app.get("/middleware/sixteen", ...layers(16), small);
}
