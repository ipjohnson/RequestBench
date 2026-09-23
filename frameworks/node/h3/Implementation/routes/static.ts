import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import { serveStatic } from "h3";

import type { Routes } from "../app.ts";

const PREFIX = "/static";

/**
 * static: h3's serveStatic over the payload directory, on a route of its own. serveStatic asks
 * getMeta for a file's size and modified time, which it writes as Content-Length and Last-Modified
 * and compares with a conditional request, and asks getContents for the bytes. Both are given the
 * request's path, so they drop the route's prefix.
 */
const files: Routes = (app, p) => {
  const file = (id: string) => join(p.directory, id.slice(PREFIX.length));

  // rb:handler static.file
  // rb:wiring static.*
  app.get(`${PREFIX}/**`, (event) =>
    serveStatic(event, {
      getMeta: async (id) => {
        const stats = await stat(file(id)).catch(() => undefined);
        return stats?.isFile() ? { size: stats.size, mtime: stats.mtimeMs } : undefined;
      },
      getContents: (id) => readFile(file(id)),
    }));
};

export default files;
