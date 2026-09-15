// RequestBench target: Express 5. Framework wiring only; behaviour from _shared/domain.js.
//
// An Express app already is a (req, res) function, so the host handler is the app itself.
//
// One file per endpoint family, under routes/. Each exports a function that is handed the
// app and registers its own routes; nothing else is shared between them. Forty-five
// handlers in one file is a file nobody reads, and a family is the unit a rewiring or a
// rerun is scoped to.
import express from "express";

import { hostMeta } from "../_shared/host.js";
import { pkgVersion } from "../_shared/version.js";
import * as d from "../_shared/domain.js";

import authorized from "./routes/authorized.js";
import baseline from "./routes/baseline.js";
import body from "./routes/body.js";
import cached from "./routes/cached.js";
import compressed from "./routes/compressed.js";
import domain from "./routes/domain.js";
import errors from "./routes/errors.js";
import headers from "./routes/headers.js";
import json from "./routes/json.js";
import middleware from "./routes/middleware.js";
import parameters from "./routes/parameters.js";
import query from "./routes/query.js";
import template from "./routes/template.js";

export const meta = { framework: "express", version: pkgVersion("express"),
                      runtime: "node " + process.versions.node, template: "handlebars" };

const app = express();
app.disable("x-powered-by");        // every production deployment does this
app.disable("etag");                // the cached family emits the pinned one instead

// Order is registration order in Express, and errors has to be last: its 404 is a
// catch-all and would otherwise swallow every route registered after it.
for (const register of [baseline, json, parameters, query, headers, middleware,
                        authorized, compressed, cached, body, domain, template, errors]) {
  register(app, { meta: () => ({ ...meta, ...hostMeta() }) });
}

export { app, d };
export const listen = (port) => new Promise((r) => r(app.listen(port)));
export const handler = app;
