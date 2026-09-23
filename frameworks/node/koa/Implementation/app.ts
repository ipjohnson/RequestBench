import Router from "@koa/router";
import Koa from "koa";

import type { Payloads } from "./payloads.ts";
import authorized from "./routes/authorized.ts";
import baseline from "./routes/baseline.ts";
import body from "./routes/body.ts";
import cache from "./routes/cache.ts";
import compressed from "./routes/compressed.ts";
import contract from "./routes/contract.ts";
import cors from "./routes/cors.ts";
import etag from "./routes/etag.ts";
import forms from "./routes/forms.ts";
import headers from "./routes/headers.ts";
import items from "./routes/items.ts";
import json from "./routes/json.ts";
import middleware from "./routes/middleware.ts";
import parameters from "./routes/parameters.ts";
import query from "./routes/query.ts";
import sse from "./routes/sse.ts";
import files from "./routes/static.ts";
import stream from "./routes/stream.ts";
import template from "./routes/template.ts";

/** One family's routes, registered on the application's router. */
export type Routes = (router: Router, context: { readonly payloads: Payloads; readonly app: Koa }) => void;

/**
 * The application, built and not listening, so the suite can hand app.callback() to supertest.
 *
 * Every family registers its routes on one @koa/router, and whatever a family needs is route
 * middleware in front of its own handlers, so it runs on those routes and on no others. One router
 * matches each request once, where a router per family would each try to match it. The errors
 * family has no routes: its answers are Koa's 404, the router's 405, and the 400 and 404 that
 * Koa's error handling writes.
 */
export function build(payloads: Payloads): Koa {
  const app = new Koa();
  // Koa writes every error it does not expose to stderr, and the body parser's 400 is one. No other
  // framework in the corpus logs a request.
  app.silent = true;

  const router = new Router();
  for (const family of [contract, authorized, baseline, body, cache, compressed, cors, etag, forms, headers, items, json, middleware, parameters, query, sse, files, stream, template]) {
    family(router, { payloads, app });
  }
  // allowedMethods answers a method the path has no route for with 405 and an Allow header, as
  // @koa/router's README mounts it.
  app.use(router.routes()).use(router.allowedMethods());
  return app;
}
