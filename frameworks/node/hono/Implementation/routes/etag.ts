// rb:wiring etag.*
import { etag } from "hono/etag";

import type { Routes } from "../app.ts";
import { fresh } from "../serial.ts";

/**
 * etag: hono/etag, given on each route. It hashes the body the handler answered with, writes the
 * tag, and answers 304 itself when If-None-Match names it. The body is built and hashed before
 * anything is compared, so a 304 saves the write and nothing else.
 */
const etags: Routes = (app, p) => {
  // rb:wiring etag.*
  // The hash is the middleware's default, SHA-1 through Web Crypto, and the tag is strong.
  const tagged = etag();

  app.get("/etag/small", tagged, (c) => fresh(c, p.small));

  app.get("/etag/large", tagged, (c) => fresh(c, p.large));
};

export default etags;
