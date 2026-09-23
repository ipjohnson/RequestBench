import { constants } from "node:zlib";

// rb:wiring compressed.*
import compress from "koa-compress";

import type { Routes } from "../app.ts";
import { fresh } from "../serial.ts";

/**
 * compressed: these routes answer like any other, and koa-compress, route middleware in front of
 * them, gzips the answer when the request asks for it.
 */
const compressed: Routes = (router, { payloads: p }) => {
  // rb:wiring compressed.*
  // On these two routes and on no other. The threshold is koa-compress's default, so a body under
  // 1 KB goes out as it is, and gzip and deflate run at the fastest level zlib offers, which every
  // framework here compresses at.
  const gzip = compress({ gzip: { level: constants.Z_BEST_SPEED }, deflate: { level: constants.Z_BEST_SPEED } });

  router.get("/compressed/small", gzip, (ctx) => fresh(ctx, p.small));

  router.get("/compressed/large", gzip, (ctx) => fresh(ctx, p.large));
};

export default compressed;
