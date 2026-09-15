// RequestBench target: Koa with @koa/router. Behaviour from _shared/domain.js.
//
// One file per endpoint family, under routes/. Each is handed the router and registers its
// own routes; nothing else is shared between them.
import Koa from "koa";
import Router from "@koa/router";

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

export const meta = { framework: "koa", version: pkgVersion("koa"),
                      runtime: "node " + process.versions.node, template: "handlebars" };

const app = new Koa();
app.silent = true;

const router = new Router();

for (const register of [baseline, json, parameters, query, headers, middleware,
                        authorized, compressed, cached, body, domain, template]) {
  register(router, { meta: () => ({ ...meta, ...hostMeta() }) });
}

// errors: the router's own miss and every failure a handler raises. Koa answers an
// unmatched route with an empty 404 and a throw with plain text, so one application
// middleware gives both the shape every other target produces.
//
// rb:snippet errors.unmatched
app.use(async (ctx, next) => {
  try {
    await next();
    if (ctx.status === 404 && ctx.body === undefined) {
      // Status before body. Koa's body setter moves an unset status to 200, and the 404
      // the router left behind is unset: it was never assigned, only defaulted.
      ctx.status = 404;
      ctx.body = d.notFoundBody();
    }
  } catch (err) {
    // koa-bodyparser raises on a body it cannot parse, which is what errors.malformed asks
    // for. The endpoint set answers 422 there, the same status as a body that parsed and
    // failed validation.
    if (err instanceof d.ValidationError) {
      ctx.status = 422;
      ctx.body = d.invalidBody(err.errors);
    } else if (err.status === 400 || err instanceof SyntaxError) {
      ctx.status = 422;
      ctx.body = d.invalidBody(d.malformed().errors);
    } else {
      ctx.status = 500;
      ctx.body = { error: "internal", message: err.message };
    }
  }
});

app.use(router.routes()).use(router.allowedMethods());

export { app };
export const listen = (port) => new Promise((r) => app.listen(port, r));
export const handler = app.callback();
