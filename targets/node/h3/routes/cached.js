// cached: validator headers and the conditional request.
//
// The ETag is pinned in the fixture, so this measures emitting the header and comparing it
// rather than hashing the body.
//
// The comparison requires a non-empty header: matching a missing if-none-match against an
// empty ETag answers 304 to a client that never asked a conditional question.
import { defineHandler } from "h3";

import * as d from "../../_shared/domain.js";

const validators = (size) => {
  const etag = d.etagOf(size);
  return (e, next) => {
    const headers = {
      etag,
      "cache-control": d.CACHEABLE,
      "x-rb-serial": d.nextSerial(),
    };
    if (e.req.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304, headers });
    }
    for (const [k, v] of Object.entries(headers)) e.res.headers.set(k, v);
    return next();
  };
};

export default function cached(app) {
  // rb:snippet cached.small cached.medium cached.large cached.revalidate
  for (const size of ["small", "medium", "large"]) {
    app.get("/cached/" + size, defineHandler({
      middleware: [validators(size)],
      handler: () => d.payload(size),
    }));
  }
}
