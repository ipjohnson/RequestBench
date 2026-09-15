// cached: validator headers and the conditional request.
//
// The ETag is pinned in the fixture, so this measures emitting the header and comparing it
// rather than hashing the body. Hono ships an etag middleware, but it computes its own
// digest and could not produce the pinned value.
//
// The comparison requires a non-empty header: matching a missing if-none-match against an
// empty ETag answers 304 to a client that never asked a conditional question.
import * as d from "../../_shared/domain.js";

const validators = (size) => {
  const etag = d.etagOf(size);
  return async (c, next) => {
    c.header("etag", etag);
    c.header("cache-control", d.CACHEABLE);
    c.header("x-rb-serial", d.nextSerial());
    if (c.req.header("if-none-match") === etag) return c.body(null, 304);
    await next();
  };
};

export default function cached(app) {
  // rb:snippet cached.small cached.medium cached.large cached.revalidate
  for (const size of ["small", "medium", "large"]) {
    app.get("/cached/" + size, validators(size), (c) => c.json(d.payload(size)));
  }
}
