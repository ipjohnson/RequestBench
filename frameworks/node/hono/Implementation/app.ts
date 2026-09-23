import { Hono } from "hono";

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

/** One family's routes, and the middleware that family puts in front of them. */
export type Routes = (app: Hono, payloads: Payloads) => void;

/**
 * The application, built and not listening, so the suite can hand it requests through app.request().
 *
 * Each family registers its routes on the one application, with their full paths. Middleware a
 * family needs is given on its own routes, or on a path under its own prefix, so it runs for that
 * family and no other. A request that matches only a route's handler skips Hono's middleware
 * composition, so the json rows pay for nothing another family installs. The errors family has no
 * routes: its answers are Hono's not-found handler's and error handler's.
 */
export function build(payloads: Payloads): Hono {
  const app = new Hono();
  for (const family of [contract, authorized, baseline, body, cache, compressed, cors, etag, forms, headers, items, json, middleware, parameters, query, sse, files, stream, template]) {
    family(app, payloads);
  }
  return app;
}
