import { createRequire } from "node:module";

import type { Routes } from "../app.ts";
import { boot } from "../boot.ts";

const require = createRequire(import.meta.url);
const version = (require("koa/package.json") as { version: string }).version;

/** /health and /__meta, which the contract asks of every framework outside the corpus. */
const contract: Routes = (router) => {
  // The payloads are loaded before the server starts, so a server that answers has them.
  router.get("/health", (ctx) => {
    ctx.body = "ok";
  });

  router.get("/__meta", (ctx) => {
    ctx.body = {
      framework: "Koa",
      version,
      runtime: `Node.js ${process.versions.node}`,
      serializer: "JSON.stringify",
      bootMs: boot.ms,
    };
  });
};

export default contract;
