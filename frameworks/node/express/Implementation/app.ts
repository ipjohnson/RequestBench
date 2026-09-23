import express, { type Express } from "express";

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

/** One family's routes, and whatever middleware that family puts in their handler lists. */
export type Routes = (app: Express, payloads: Payloads) => void;

/**
 * The application, built and not listening, so the suite can send it requests through supertest.
 *
 * Each family registers its routes on the application, and a middleware a family uses sits in the
 * handler list of that family's routes, so it runs on those routes and on no others. Express tries
 * routes in the order they were registered. The errors family has no routes: its answers are
 * Express's final handler's and the items handlers'.
 */
export function build(payloads: Payloads): Express {
  const app = express();
  // Express's production security guide says to turn this header off.
  app.disable("x-powered-by");
  // Express hashes every body res.send writes for an ETag unless told not to. The etag family's
  // sub-application turns it back on for its own routes, so no other row carries the hash.
  app.disable("etag");
  for (const family of [contract, authorized, baseline, body, cache, compressed, cors, etag, forms, headers, items, json, middleware, parameters, query, sse, files, stream, template]) {
    family(app, payloads);
  }
  return app;
}
