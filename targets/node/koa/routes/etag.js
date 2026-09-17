// etag: koa-etag and koa-conditional-get, which is the pair Koa's own documentation wires.
//
// koa-etag hashes the body the handler set, koa-conditional-get compares it against
// if-none-match through ctx.fresh and rewrites the response to 304. Registered as route
// middleware rather than on the app, so a digest is not taken over every response in the
// blend: conditional first, so that it sees the tag the one below it wrote.
import conditional from "koa-conditional-get";
import etagMiddleware from "koa-etag";

import * as d from "../../_shared/domain.js";

export default function etag(router) {
  // rb:snippet etag.small etag.large etag.match_large etag.stale_large
  for (const size of ["small", "large"]) {
    router.get("/etag/" + size, conditional(), etagMiddleware(), (ctx) => {
      ctx.set({ "cache-control": d.CACHEABLE, "x-rb-serial": d.nextSerial() });
      ctx.body = d.payload(size);
    });
  }
}
