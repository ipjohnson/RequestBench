// RequestBench target: h3 v2. Behaviour from _shared/domain.js.
//
// One file per endpoint family, under routes/. Each is handed the app and registers its
// own routes; nothing else is shared between them.
import { H3, toNodeHandler, serve } from "h3";

import { hostMeta } from "../_shared/host.js";
import { pkgVersion } from "../_shared/version.js";
import * as d from "../_shared/domain.js";

import authorized from "./routes/authorized.js";
import baseline from "./routes/baseline.js";
import body from "./routes/body.js";
import cached from "./routes/cached.js";
import compressed from "./routes/compressed.js";
import domain from "./routes/domain.js";
import headers from "./routes/headers.js";
import json from "./routes/json.js";
import middleware from "./routes/middleware.js";
import parameters from "./routes/parameters.js";
import query from "./routes/query.js";
import template from "./routes/template.js";

export const meta = { framework: "h3", version: pkgVersion("h3"),
                      runtime: "node " + process.versions.node, template: "handlebars" };

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
    if (err instanceof d.ValidationError) {
      e.res.status = 422;
      return d.invalidBody(err.errors);
    }
    // readBody rejects a body it cannot parse with a 400 HTTPError rather than a
    // SyntaxError, and that is what errors.malformed asks for. The endpoint set answers
    // 422 there, the same status as a body that parsed and failed validation.
    if (wrapped?.status === 400) {
      e.res.status = 422;
      return d.invalidBody(d.malformed().errors);
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
                        authorized, compressed, cached, body, domain, template]) {
  register(app, { meta: () => ({ ...meta, ...hostMeta() }) });
}

export { app };
export const listen = (port) => new Promise((r) => serve(app, { port, silent: true }) && r());
export const handler = toNodeHandler(app);
