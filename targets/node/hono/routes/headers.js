// headers: the request header map, read by nothing on /headers and bound on /headers/bind.
//
// The /headers handler reads no header at all, so headers.many minus headers.few is the cost
// of materialising 25 more that nobody asked for.
//
// validator("header", fn) is where Hono binds headers, the way validator("query", fn) binds
// the query: a route-level hook that hands the check every request header and keeps what it
// returns. The conversion is this target's own, and the handler reads the result back with
// c.req.valid("header"). This is this target's copy on purpose.
import { validator } from "hono/validator";

import * as d from "../../_shared/domain.js";

// rb:wiring headers.*
const int = (v) => { const n = Number(v); return Number.isInteger(n) ? n : 0; };

// rb:wiring headers.*
const bindsHeaders = validator("header", (h) => ({
  tenant: h["x-rb-tenant"], request_id: h["x-rb-request-id"], account: int(h["x-rb-account"]),
}));

export default function headers(app) {
  app.get("/headers", (c) => c.json(d.payload("small")));

  app.get("/headers/bind", bindsHeaders,
    (c) => c.json(d.withEcho("small", c.req.valid("header"))));
}
