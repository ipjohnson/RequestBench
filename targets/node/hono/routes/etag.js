// etag: Hono's own etag middleware.
//
// hono/etag hashes the body the handler returned and answers the conditional itself, so
// nothing here compares anything. Scoped to the route prefix, because a digest over every
// JSON response in the blend would contaminate the baseline these rows subtract.
import { etag as etagMiddleware } from "hono/etag";

import * as d from "../../_shared/domain.js";

export default function etag(app) {
  app.use("/etag/*", etagMiddleware());
  // rb:snippet etag.small etag.large etag.match_large etag.stale_large
  for (const size of ["small", "large"]) {
    app.get("/etag/" + size, (c) => {
      c.header("cache-control", d.CACHEABLE);
      c.header("x-rb-serial", d.nextSerial());
      return c.json(d.payload(size));
    });
  }
}
