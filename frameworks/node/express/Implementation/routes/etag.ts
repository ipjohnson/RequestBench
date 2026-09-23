import express from "express";

import type { Routes } from "../app.ts";
import { serial } from "../serial.ts";

/**
 * etag: Express's own conditional-request machinery. With the `etag` setting on, res.send hashes
 * the body it is about to write, writes the tag, and answers 304 itself when If-None-Match names it.
 * The body is built and hashed before anything is compared, so a 304 saves the write and nothing
 * else. The setting is an application's, so these routes are a sub-application mounted at /etag,
 * whose own setting is on while the application's is off.
 */
const etags: Routes = (app, p) => {
  // rb:wiring etag.*
  // A sub-application starts from Express's defaults, so it has to turn x-powered-by off again.
  const scope = express();
  scope.disable("x-powered-by");
  // Express's default: a weak tag over the body, its length and a SHA-1 of it in base64.
  scope.set("etag", "weak");
  // rb:end

  // rb:handler etag.small
  scope.get("/small", (_request, response) => serial(response).json(p.small));

  // rb:handler etag.large,etag.match_large,etag.stale_large
  scope.get("/large", (_request, response) => serial(response).json(p.large));

  // rb:wiring etag.*
  app.use("/etag", scope);
};

export default etags;
