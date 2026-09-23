// rb:wiring static.*
import { serveStatic } from "@hono/node-server/serve-static";

import type { Routes } from "../app.ts";

/** static: serveStatic from @hono/node-server, the Node adapter's own, serving the payload directory. */
const files: Routes = (app, p) => {
  // rb:handler static.file
  // rb:wiring static.*
  // It joins the request's path to its root, so the /static prefix is taken off first.
  app.use("/static/*", serveStatic({ root: p.directory, rewriteRequestPath: (path) => path.slice("/static".length) }));
};

export default files;
