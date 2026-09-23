import { stream as streamed } from "hono/streaming";

import type { Routes } from "../app.ts";

/**
 * stream: items.medium's rows written one per line as each is produced, through stream from Hono's
 * streaming helper. The length is never known, so the answer goes out chunked.
 */
const stream: Routes = (app, p) => {
  app.get("/stream/items", (c) => {
    c.header("content-type", "application/x-ndjson");
    return streamed(c, async (out) => {
      for (const row of p.medium.items) await out.write(`${JSON.stringify(row)}\n`);
    });
  });
};

export default stream;
