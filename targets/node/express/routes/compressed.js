// compressed: outbound gzip, the cost of the wiring declining and the cost of it working.
//
// The middleware is mounted on a router carrying only these three routes. On the app it
// would put a "did the client ask?" check on all forty-five endpoints and contaminate the
// rows this family is measured against, which is why they have their own paths instead of
// riding on /json with an accept-encoding header.
import compression from "compression";
import express from "express";

import * as d from "../../_shared/domain.js";

// Level is pinned across every language. The size threshold is left at the library's own
// default, because whether a framework bothers to compress a body too small to benefit is
// what compressed.gzip_small is in the set to show.
const gzip = compression({ level: d.GZIP_LEVEL });

export default function compressed(app) {
  const routes = express.Router();
  routes.use(gzip);

  // rb:snippet compressed.identity_small compressed.identity_medium compressed.identity_large
  // rb:snippet compressed.gzip_small compressed.gzip_medium compressed.gzip_large
  for (const size of ["small", "medium", "large"]) {
    routes.get("/compressed/" + size, (_, res) =>
      res.set("x-rb-serial", d.nextSerial()).json(d.payload(size)));
  }

  app.use(routes);
}
