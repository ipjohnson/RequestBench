// RequestBench target: Hono. Framework wiring only; behaviour from _shared/domain.js.
//
// One file per endpoint family, under routes/. Each exports a function that is handed the
// app and registers its own routes; nothing else is shared between them.
import { Hono } from "hono";
import { serve, getRequestListener } from "@hono/node-server";

import { hostMeta } from "../_shared/host.js";
import { pkgVersion } from "../_shared/version.js";
import * as d from "../_shared/domain.js";
import { HTTPException } from "hono/http-exception";
import { notBound } from "./validation.js";

import authorized from "./routes/authorized.js";
import baseline from "./routes/baseline.js";
import body from "./routes/body.js";
import cached from "./routes/cached.js";
import compressed from "./routes/compressed.js";
import domain from "./routes/domain.js";
import headers from "./routes/headers.js";
import json from "./routes/json.js";
import middleware from "./routes/middleware.js";
import parameters from "./routes/parameters.js";
import query from "./routes/query.js";
import template from "./routes/template.js";

export const meta = { framework: "hono", version: pkgVersion("hono"),
                      runtime: "node " + process.versions.node, template: "hono/html" };

const app = new Hono();

for (const register of [baseline, json, parameters, query, headers, middleware,
                        authorized, compressed, cached, body, domain, template]) {
  register(app, { meta: () => ({ ...meta, ...hostMeta() }) });
}

// errors: the router's own miss and every failure a handler raises. Hono takes both as
// application hooks rather than as routes, which is why this family has no file.
// rb:snippet errors.unmatched
app.notFound((c) => c.json(d.notFoundBody(), 404));

app.onError((err, c) => {
  // The validator hook answers a failed body itself, so nothing validation-shaped reaches
  // here. A body Hono could not parse never got as far as the hook: the hook reads the JSON
  // and raises Hono's own HTTPException for it, which carries the 400 and the wording. It
  // names no field, because nothing validated anything.
  if (err instanceof HTTPException) return c.json(notBound(err.message), err.status);
  if (err instanceof SyntaxError) return c.json(notBound(err.message), 400);
  return c.json({ error: "internal", message: err.message }, 500);
});

export { app };
export const listen = (port) => new Promise((r) => serve({ fetch: app.fetch, port }, r));
export const handler = getRequestListener(app.fetch);
