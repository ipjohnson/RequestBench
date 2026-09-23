import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Routes } from "../app.ts";
import { boot } from "../boot.ts";

/**
 * The version in the package.json of an installed package, found by walking up from its entry point,
 * because srvx exports no package.json.
 */
function versionOf(name: string): string {
  for (let dir = dirname(fileURLToPath(import.meta.resolve(name))); dir !== dirname(dir); dir = dirname(dir)) {
    const file = join(dir, "package.json");
    if (!existsSync(file)) continue;
    const manifest = JSON.parse(readFileSync(file, "utf8")) as { name?: string; version: string };
    if (manifest.name === name) return manifest.version;
  }
  throw new Error(`no package.json for ${name}`);
}

const meta = {
  framework: "h3",
  version: versionOf("h3"),
  runtime: `Node.js ${process.versions.node}`,
  adapter: `srvx ${versionOf("srvx")}`,
  serializer: "JSON.stringify",
};

/** /health and /__meta, which the contract asks of every framework outside the corpus. */
const contract: Routes = (app) => {
  // The payloads are loaded before the server starts, so a server that answers has them.
  app.get("/health", () => "ok");

  app.get("/__meta", () => ({ ...meta, bootMs: boot.ms }));
};

export default contract;
