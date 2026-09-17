// etag: Express's own conditional-request machinery.
//
// res.send hashes the body it is about to write and req.fresh answers the conditional, both
// from the `etag` setting rather than from anything written here. The setting is per-app, so
// the routes live on a mounted sub-app: turning it on for the whole app would put a hash on
// every JSON response in the blend and contaminate the baseline these rows subtract.
//
// Sub-app settings prototype-chain to the parent's, so enabling it here shadows the app-wide
// disable without reaching the routes outside /etag.
import express from "express";

import * as d from "../../_shared/domain.js";

export default function etag(app) {
  // rb:wiring etag.*
  const scope = express();
  scope.enable("etag");               // express's default is weak, base64 sha1 over the body
  // rb:handler etag.*
  for (const size of ["small", "large"]) {
    scope.get("/" + size, (_, res) => {
      res.set({ "cache-control": d.CACHEABLE, "x-rb-serial": d.nextSerial() });
      res.json(d.payload(size));
    });
  }
  // rb:wiring etag.*
  app.use("/etag", scope);
}
