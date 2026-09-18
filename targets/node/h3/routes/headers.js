// headers: the request header map, read by nothing on /headers and bound on /headers/bind.
//
// The /headers handler reads no header at all, so headers.many minus headers.few is the cost
// of materialising 25 more that nobody asked for.
//
// h3 has no header binder that converts: defineValidatedHandler validates headers against a
// Standard Schema and writes the result back into the Headers, which hold strings. So
// /headers/bind reads its three from the Request's own Headers and converts the account
// itself. This is this target's copy on purpose, and nothing else imports this file.
import * as d from "../../_shared/domain.js";

// rb:wiring headers.*
const int = (v) => { const n = Number(v); return Number.isInteger(n) ? n : 0; };

export default function headers(app) {
  app.get("/headers", () => d.payload("small"));

  app.get("/headers/bind", (e) => d.withEcho("small", {
    tenant: e.req.headers.get("x-rb-tenant"),
    request_id: e.req.headers.get("x-rb-request-id"),
    account: int(e.req.headers.get("x-rb-account")),
  }));
}
