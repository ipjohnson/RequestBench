// RequestBench target: h3 v2. Behaviour from _shared/domain.js.
//
// One file per endpoint family, under routes/. Each is handed the app and registers its
// own routes; nothing else is shared between them.
import { H3, toNodeHandler, serve } from "h3";

import { hostMeta } from "../_shared/host.js";
import { pkgVersion } from "../_shared/version.js";
import * as d from "../_shared/domain.js";
import { notBound } from "./validation.js";

import authorized from "./routes/authorized.js";
import baseline from "./routes/baseline.js";
import body from "./routes/body.js";
import cache from "./routes/cache.js";
import compressed from "./routes/compressed.js";
import domain from "./routes/domain.js";
import etag from "./routes/etag.js";
import headers from "./routes/headers.js";
import json from "./routes/json.js";
import middleware from "./routes/middleware.js";
import parameters from "./routes/parameters.js";
import query from "./routes/query.js";
import template from "./routes/template.js";

export const meta = { framework: "h3", version: pkgVersion("h3"),
                      runtime: "node " + process.versions.node, template: "ejs",
                      etag: "sha1-base64 (h3 compares, it does not hash)",
                      cache: "ocache " + pkgVersion("ocache") + " memory storage" };

// h3 v2 takes the error handler on the constructor; assigning app.onError afterwards is
// silently ignored, which showed up as 500s where the contract says 422.
//
// errors: the router's own miss arrives here as an HTTPError with status 404, which is
// what gives errors.unmatched the same body as errors.not_found.
//
// rb:snippet errors.unmatched
const app = new H3({
  onError(wrapped, e) {
    // h3 v2 wraps a thrown error in HTTPError and puts the original on .cause, so the
    // instanceof check has to look through it or every validation failure reads as a 500.
    const err = wrapped?.cause instanceof Error ? wrapped.cause : wrapped;
    // readBody rejects a body it cannot parse with a 400 HTTPError rather than a
    // SyntaxError. That never reached the walk, so it names no field and keeps the 400 h3
    // chose; a body that parsed and then failed the walk answers 422 where the walk is.
    if (wrapped?.status === 400) {
      e.res.status = 400;
      return notBound(err.message);
    }
    if (wrapped?.status === 404) {
      e.res.status = 404;
      return d.notFoundBody();
    }
    e.res.status = 500;
    return { error: "internal", message: err.message };
  },
});

for (const register of [baseline, json, parameters, query, headers, middleware,
                        authorized, compressed, etag, cache, body, domain, template]) {
  register(app, { meta: () => ({ ...meta, ...hostMeta() }) });
}

export { app };
export const listen = (port) => new Promise((r) => serve(app, { port, silent: true }) && r());
export const handler = toNodeHandler(app);
