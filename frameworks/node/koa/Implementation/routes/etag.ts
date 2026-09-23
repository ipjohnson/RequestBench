// rb:wiring etag.*
import etag from "@koa/etag";
import conditional from "koa-conditional-get";

import type { Routes } from "../app.ts";
import { fresh } from "../serial.ts";

/**
 * etag: @koa/etag with koa-conditional-get, the pair @koa/etag's README wires. @koa/etag hashes
 * the body the handler set and writes the tag, and koa-conditional-get turns the answer into a 304
 * when If-None-Match names it. The body is built and hashed before anything is compared, so a 304
 * saves the write and nothing else.
 */
const etags: Routes = (router, { payloads: p }) => {
  // rb:wiring etag.*
  // Route middleware on these two routes and on no other. koa-conditional-get comes first, so it
  // sees the tag @koa/etag writes once the handler has returned. The hash is the etag package's, a
  // SHA-1 of the serialised body.
  const validated = [conditional(), etag()];

  router.get("/etag/small", ...validated, (ctx) => fresh(ctx, p.small));

  router.get("/etag/large", ...validated, (ctx) => fresh(ctx, p.large));
};

export default etags;
