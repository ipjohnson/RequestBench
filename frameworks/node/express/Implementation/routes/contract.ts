import { createRequire } from "node:module";

import type { Routes } from "../app.ts";
import { boot } from "../boot.ts";

const require = createRequire(import.meta.url);
const version = (require("express/package.json") as { version: string }).version;

/** /health and /__meta, which the contract asks of every framework outside the corpus. */
const contract: Routes = (app) => {
  // The payloads are loaded before the server starts, so a server that answers has them.
  app.get("/health", (_request, response) => response.type("text/plain").send("ok"));

  app.get("/__meta", (_request, response) => response.json({
    framework: "Express",
    version,
    runtime: `Node.js ${process.versions.node}`,
    serializer: "JSON.stringify",
    bootMs: boot.ms,
  }));
};

export default contract;
