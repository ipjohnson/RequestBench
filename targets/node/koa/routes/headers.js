// headers: the request header map, read by nothing on /headers and bound on /headers/bind.
//
// The /headers handler reads no header at all, so headers.many minus headers.few is the cost
// of materialising 25 more that nobody asked for.
//
// Koa has no header binder to plug into: /headers/bind reads its three with ctx.get and
// converts the account itself. This is this target's copy on purpose, and nothing else imports
// this file.
import * as d from "../../_shared/domain.js";

// rb:wiring headers.*
const int = (v) => { const n = Number(v); return Number.isInteger(n) ? n : 0; };

export default function headers(router) {
  router.get("/headers", (ctx) => { ctx.body = d.payload("small"); });

  router.get("/headers/bind", (ctx) => {
    ctx.body = d.withEcho("small", {
      tenant: ctx.get("x-rb-tenant"),
      request_id: ctx.get("x-rb-request-id"),
      account: int(ctx.get("x-rb-account")),
    });
  });
}
