// cached: validator headers and the conditional request.
//
// The ETag is pinned in the fixture, so this measures emitting the header and comparing it
// rather than hashing the body. The size is closed over per route rather than sliced back
// out of the URL, which carries the query string.
//
// The comparison requires a non-empty header: matching a missing if-none-match against an
// empty ETag answers 304 to a client that never asked a conditional question.
import * as d from "../../_shared/domain.js";

const validators = (size) => {
  const etag = d.etagOf(size);
  return (req, res, next) => {
    res.set({ etag, "cache-control": d.CACHEABLE, "x-rb-serial": d.nextSerial() });
    if (req.headers["if-none-match"] === etag) return res.status(304).end();
    next();
  };
};

export default function cached(app) {
  // rb:snippet cached.small cached.medium cached.large cached.revalidate
  for (const size of ["small", "medium", "large"]) {
    app.get("/cached/" + size, validators(size), (_, res) => res.json(d.payload(size)));
  }
}
