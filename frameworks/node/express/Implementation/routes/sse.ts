import { Readable } from "node:stream";

import type { Routes } from "../app.ts";
import type { Item } from "../payloads.ts";

/** Each row as the data of one event, written by JSON.stringify. */
function* events(rows: readonly Item[]): Generator<string> {
  for (const row of rows) yield `data: ${JSON.stringify(row)}\n\n`;
}

/**
 * sse: items.medium's rows as server-sent events. Express has no support for them, and neither has
 * the expressjs organisation, so the handler writes the event-stream headers and pipes each row in
 * as the data of one event, as stream.ndjson pipes its lines.
 */
const sse: Routes = (app, p) => {
  app.get("/sse/medium", (_request, response) => {
    response.set({ "content-type": "text/event-stream", "cache-control": "no-cache" });
    Readable.from(events(p.medium.items)).pipe(response);
  });
};

export default sse;
