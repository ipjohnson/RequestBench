// RequestBench target: Koa with @koa/router. Behaviour from _shared/domain.js.
//
// One file per endpoint family, under routes/. Each is handed the router and registers its
// own routes; nothing else is shared between them.
import Koa from "koa";
import Router from "@koa/router";

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

export const meta = { framework: "koa", version: pkgVersion("koa"),
                      runtime: "node " + process.versions.node, template: "ejs",
                      etag: "koa-etag sha1-base64",
                      cache: "koa-cash " + pkgVersion("koa-cash") + " over lru-cache" };

const app = new Koa();
app.silent = true;

const router = new Router();

for (const register of [baseline, json, parameters, query, headers, middleware,
                        authorized, compressed, etag, cache, body, domain, template]) {
  register(router, { app, meta: () => ({ ...meta, ...hostMeta() }) });
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
    // koa-bodyparser raises on a body it cannot parse. That never reached the walk, so it
    // names no field and answers 400; a body that parsed and then failed the walk answers
    // 422 where the walk itself is.
    if (err.status === 400 || err instanceof SyntaxError) {
      ctx.status = 400;
      ctx.body = notBound(err.message);
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
