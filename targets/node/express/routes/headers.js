// headers: the request header map, read by nothing on /headers and bound on /headers/bind.
//
// The /headers handler reads no header at all, so headers.many minus headers.few is the cost
// of materialising 25 more that nobody asked for.
//
// Express has no header binder to plug into: /headers/bind reads its three with req.get and
// converts the account itself. This is this target's copy on purpose, and nothing else imports
// this file.
import * as d from "../../_shared/domain.js";

// rb:wiring headers.*
const int = (v) => { const n = Number(v); return Number.isInteger(n) ? n : 0; };

export default function headers(app) {
  app.get("/headers", (_, res) => res.json(d.payload("small")));

  app.get("/headers/bind", (req, res) => res.json(d.withEcho("small", {
    tenant: req.get("x-rb-tenant"),
    request_id: req.get("x-rb-request-id"),
    account: int(req.get("x-rb-account")),
  })));
}
