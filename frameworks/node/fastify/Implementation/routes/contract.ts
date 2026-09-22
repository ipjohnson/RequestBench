import { createRequire } from "node:module";

import type { Routes } from "../app.ts";
import { boot } from "../boot.ts";

const require = createRequire(import.meta.url);
const serializer = (require("fast-json-stringify/package.json") as { version: string }).version;

/** /health and /__meta, which the contract asks of every framework outside the corpus. */
const contract: Routes = async (app) => {
  // The payloads are loaded before the server starts, so a server that answers has them.
  app.get("/health", async () => "ok");

  app.get("/__meta", async () => ({
    framework: "Fastify",
    version: app.version,
    runtime: `Node.js ${process.versions.node}`,
    serializer: `fast-json-stringify ${serializer}`,
    bootMs: boot.ms,
  }));
};

export default contract;
