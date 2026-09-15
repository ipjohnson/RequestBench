// middleware: per-layer dispatch cost at 0, 4 and 16 no-op layers.
//
// h3 v2 takes a middleware list on defineHandler, which is the scoping the family needs.
// Each layer calls next() and does nothing else.
import { defineHandler } from "h3";

import * as d from "../../_shared/domain.js";

const noop = (_e, next) => next();

const layers = (n) => Array.from({ length: n }, () => noop);

const small = () => d.payload("small");

export default function middleware(app) {
  app.get("/middleware/none", small);

  app.get("/middleware/four", defineHandler({ middleware: layers(4), handler: small }));

  app.get("/middleware/sixteen", defineHandler({ middleware: layers(16), handler: small }));
}
