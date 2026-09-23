import { Readable } from "node:stream";

import type { Routes } from "../app.ts";
import type { Item } from "../payloads.ts";

/** Each row as a line. */
function* lines(rows: readonly Item[]): Generator<string> {
  for (const row of rows) yield `${JSON.stringify(row)}\n`;
}

/**
 * stream: items.medium's rows written one per line as each is produced. Koa pipes a stream it is
 * given as the body into the response, and its length is never known, so it goes out chunked.
 */
const stream: Routes = (router, { payloads: p }) => {
  router.get("/stream/items", (ctx) => {
    ctx.type = "application/x-ndjson";
    ctx.body = Readable.from(lines(p.medium.items));
  });
};

export default stream;
