import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Routes } from "../app.ts";
import { boot } from "../boot.ts";

/** The version in a package's own package.json, which neither hono nor @hono/node-server exports. */
function versionOf(name: string): string {
  for (let dir = dirname(fileURLToPath(import.meta.resolve(name))); dir !== dirname(dir); dir = dirname(dir)) {
    const file = join(dir, "package.json");
    if (!existsSync(file)) continue;
    const manifest = JSON.parse(readFileSync(file, "utf8")) as { name?: string; version: string };
    if (manifest.name === name) return manifest.version;
  }
  throw new Error(`no package.json names ${name}`);
}

const meta = {
  framework: "Hono",
  version: versionOf("hono"),
  runtime: `Node.js ${process.versions.node}`,
  serializer: "JSON.stringify",
  adapter: `@hono/node-server ${versionOf("@hono/node-server")}`,
};

/** /health and /__meta, which the contract asks of every framework outside the corpus. */
const contract: Routes = (app) => {
  // The payloads are loaded before the server starts, so a server that answers has them.
  app.get("/health", (c) => c.text("ok"));

  app.get("/__meta", (c) => c.json({ ...meta, adapter: boot.adapter ?? meta.adapter, bootMs: boot.ms }));
};

export default contract;
