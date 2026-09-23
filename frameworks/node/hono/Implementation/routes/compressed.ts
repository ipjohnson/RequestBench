// rb:wiring compressed.*
import { compress } from "hono/compress";

import type { Routes } from "../app.ts";
import { fresh } from "../serial.ts";

/**
 * compressed: these routes answer like any other, and hono/compress, given on each of them, gzips
 * the answer when the request asks for it. It compresses through the platform's CompressionStream,
 * which takes no level, so on Node the answer is gzipped at zlib's default level, 6.
 */
const compressed: Routes = (app, p) => {
  // rb:wiring compressed.*
  // Its options are the defaults: gzip or deflate by Accept-Encoding, and a 1 KB threshold that it
  // reads from Content-Length, which c.json does not set, so every answer is compressed.
  const gzip = compress();

  app.get("/compressed/small", gzip, (c) => fresh(c, p.small));

  app.get("/compressed/large", gzip, (c) => fresh(c, p.large));
};

export default compressed;
