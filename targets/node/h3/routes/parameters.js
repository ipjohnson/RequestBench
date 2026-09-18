// parameters: router captures with segment depth held constant, bound as integers and echoed.
//
// getValidatedRouterParams is h3's own replacement for getRouterParams, the way
// getValidatedQuery replaces getQuery: it reads the route's captures, hands them to the check
// and answers its own 400 HTTPError if the check throws or returns false. The conversion is
// this target's, and h3 decides when it runs. This is this target's copy on purpose.
import { getValidatedRouterParams } from "h3";

import * as d from "../../_shared/domain.js";

// rb:wiring parameters.*
const int = (v) => { const n = Number(v); return Number.isInteger(n) ? n : 0; };

// rb:wiring parameters.*
const one = (p) => ({ one: int(p.one) });

// rb:wiring parameters.*
const two = (p) => ({ one: int(p.one), two: int(p.two) });

export default function parameters(app) {
  // rou3 tries a static segment before a capture, so this path reaches its own route rather
  // than the one-capture route that also matches it.
  app.get("/parameters/static/segment/literal", () => d.payload("small"));

  app.get("/parameters/:one/segment/literal",
    async (e) => d.withEcho("small", await getValidatedRouterParams(e, one)));

  app.get("/parameters/:one/with-second/:two",
    async (e) => d.withEcho("small", await getValidatedRouterParams(e, two)));
}
