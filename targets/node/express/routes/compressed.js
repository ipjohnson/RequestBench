// compressed: outbound gzip, the cost of the wiring declining and the cost of it working.
//
// The middleware is mounted on a router carrying only these three routes. On the app it
// would put a "did the client ask?" check on all forty-five endpoints and contaminate the
// rows this family is measured against, which is why they have their own paths instead of
// riding on /json with an accept-encoding header.
// rb:wiring compressed.*
import compression from "compression";
import express from "express";
import zlib from "node:zlib";

import * as d from "../../_shared/domain.js";

// The size threshold is left at the library's own default, because whether a framework
// bothers to compress a body too small to benefit is what compressed.gzip_small is in the
// set to show.
// rb:wiring compressed.*
const gzip = compression({ level: zlib.constants.Z_BEST_SPEED });

export default function compressed(app) {
  const routes = express.Router();
  // rb:wiring compressed.*
  routes.use(gzip);

  // rb:handler compressed.*
  for (const size of ["small", "medium", "large"]) {
    routes.get("/compressed/" + size, (_, res) =>
      res.set("x-rb-serial", d.nextSerial()).json(d.payload(size)));
  }

  app.use(routes);
}
