// rb:wiring static.*
import { send } from "@koa/send";

import type { Routes } from "../app.ts";

/**
 * static: @koa/send, the Koa organisation's file sender, on one route over the payload directory.
 * koa-static wraps the same sender as application middleware, which would look for a file on
 * every request the application receives.
 */
const files: Routes = (router, { payloads: p }) => {
  // rb:wiring static.*
  // rb:handler static.file
  router.get("/static/:name", async (ctx) => {
    await send(ctx, ctx.params["name"] ?? "", { root: p.directory });
  });
};

export default files;
