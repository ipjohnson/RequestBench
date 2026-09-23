import { H3 } from "h3";

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

/** One family's routes, registered on the application it is handed. */
export type Routes = (app: H3, payloads: Payloads) => void;

/**
 * The application, built and not listening, so the suite can hand it requests through
 * app.request().
 *
 * Each family registers its routes on the one H3 instance. A middleware a family uses is given to
 * its own routes, in the route's options. h3 runs a middleware registered with app.use() on every
 * request, even one that names a path, so nothing is registered that way. The errors family has no
 * routes: its answers are the router's miss, the body reader's and the items handlers'.
 */
export function build(payloads: Payloads): H3 {
  const app = new H3();
  for (const family of [contract, authorized, baseline, body, cache, compressed, cors, etag, forms, headers, items, json, middleware, parameters, query, sse, files, stream, template]) {
    family(app, payloads);
  }
  return app;
}
