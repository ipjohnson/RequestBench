// rb:wiring cors.*
import { cors as policy } from "hono/cors";

import type { Routes } from "../app.ts";
import { fresh } from "../serial.ts";

/**
 * cors: hono/cors on every path under /cors. It answers a preflight itself, before any handler
 * runs, and adds its headers to the request it lets through. The handler writes x-rb-serial, so
 * its absence on a preflight shows the middleware answered alone.
 */
const cors: Routes = (app, p) => {
  const { origin, method, header, maxAgeSeconds } = p.settings.cors;

  // rb:wiring cors.*
  // A string origin is written back only to that origin, and the answer carries Vary: Origin.
  app.use("/cors/*", policy({ origin, allowMethods: [method], allowHeaders: [header], maxAge: maxAgeSeconds }));

  app.get("/cors/small", (c) => fresh(c, p.small));
};

export default cors;
