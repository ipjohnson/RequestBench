// parameters: router captures with segment depth held constant, bound as integers and echoed.
//
// validator("param", fn) is where Hono binds captures, the way validator("query", fn) binds
// the query: a route-level hook that hands the check the route's captures and keeps what it
// returns. The conversion is this target's own, and the handler reads the result back with
// c.req.valid("param"). This is this target's copy on purpose.
import { validator } from "hono/validator";

import * as d from "../../_shared/domain.js";

// rb:wiring parameters.*
const int = (v) => { const n = Number(v); return Number.isInteger(n) ? n : 0; };

// rb:wiring parameters.*
const bindsOne = validator("param", (p) => ({ one: int(p.one) }));

// rb:wiring parameters.*
const bindsTwo = validator("param", (p) => ({ one: int(p.one), two: int(p.two) }));

export default function parameters(app) {
  // Registered ahead of the one-capture route, which also matches this path: Hono answers
  // from the first handler registered for it.
  app.get("/parameters/static/segment/literal", (c) => c.json(d.payload("small")));

  app.get("/parameters/:one/segment/literal", bindsOne,
    (c) => c.json(d.withEcho("small", c.req.valid("param"))));

  app.get("/parameters/:one/with-second/:two", bindsTwo,
    (c) => c.json(d.withEcho("small", c.req.valid("param"))));
}
