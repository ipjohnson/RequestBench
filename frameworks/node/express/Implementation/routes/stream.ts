import { Readable } from "node:stream";

import type { Routes } from "../app.ts";
import type { Item } from "../payloads.ts";

/** Each row as a line, written by JSON.stringify, as res.json writes a payload. */
function* lines(rows: readonly Item[]): Generator<string> {
  for (const row of rows) yield `${JSON.stringify(row)}\n`;
}

/**
 * stream: items.medium's rows written one per line as each is produced. Express has no streaming
 * helper of its own, and its response is Node's, so a Readable of lines is piped into it. Its length
 * is never known, so it goes out chunked.
 */
const stream: Routes = (app, p) => {
  app.get("/stream/items", (_request, response) => {
    response.type("application/x-ndjson");
    Readable.from(lines(p.medium.items)).pipe(response);
  });
};

export default stream;
