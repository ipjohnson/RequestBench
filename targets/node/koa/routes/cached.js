// cached: validator headers and the conditional request.
//
// The ETag is pinned in the fixture, so this measures emitting the header and comparing it
// rather than hashing the body. Koa's ctx.fresh would work from an ETag it was given, but
// it also consults Cache-Control and Last-Modified, and this family is only about the one
// comparison.
//
// The comparison requires a non-empty header: matching a missing if-none-match against an
// empty ETag answers 304 to a client that never asked a conditional question.
import * as d from "../../_shared/domain.js";

const validators = (size) => {
  const etag = d.etagOf(size);
  return async (ctx, next) => {
    ctx.set({ etag, "cache-control": d.CACHEABLE, "x-rb-serial": d.nextSerial() });
    if (ctx.headers["if-none-match"] === etag) {
      ctx.status = 304;
      return;
    }
    await next();
  };
};

export default function cached(router) {
  // rb:snippet cached.small cached.medium cached.large cached.revalidate
  for (const size of ["small", "medium", "large"]) {
    router.get("/cached/" + size, validators(size), (ctx) => { ctx.body = d.payload(size); });
  }
}
