import { Readable } from "node:stream";

import type { Routes } from "../app.ts";
import type { Item } from "../payloads.ts";
import { serializeItem } from "../schemas.ts";

/** Each row as a line, written by the function the json rows' item schema compiles to. */
function* lines(rows: readonly Item[]): Generator<string> {
  for (const row of rows) yield `${serializeItem(row)}\n`;
}

/**
 * stream: items.medium's rows written one per line as each is produced. Fastify pipes a Readable
 * the handler returns into the response, and its length is never known, so it goes out chunked.
 */
const stream: Routes = async (app, { payloads: p }) => {
  app.get("/stream/items", async (_request, reply) => {
    reply.type("application/x-ndjson");
    return Readable.from(lines(p.medium.items));
  });
};

export default stream;
