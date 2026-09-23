import { Readable } from "node:stream";

import type { Routes } from "../app.ts";
import type { Item } from "../payloads.ts";

/** Each row as the data of one event. */
function* events(rows: readonly Item[]): Generator<string> {
  for (const row of rows) yield `data: ${JSON.stringify(row)}\n\n`;
}

/**
 * sse: items.medium's rows as server-sent events. Koa has no helper for them, and the Koa
 * organisation publishes none. Its stream-server-side-events example sets the type and gives Koa
 * a stream of `data:` lines as the body, which Koa pipes into the response, and this does the same.
 */
const sse: Routes = (router, { payloads: p }) => {
  router.get("/sse/medium", (ctx) => {
    ctx.type = "text/event-stream; charset=utf-8";
    ctx.set("cache-control", "no-cache");
    ctx.body = Readable.from(events(p.medium.items));
  });
};

export default sse;
