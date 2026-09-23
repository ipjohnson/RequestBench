import { iterable } from "h3";

import type { Routes } from "../app.ts";
import type { Item } from "../payloads.ts";

/** Each row as a line. */
function* lines(rows: readonly Item[]): Generator<string> {
  for (const row of rows) yield `${JSON.stringify(row)}\n`;
}

/**
 * stream: items.medium's rows written one per line as each is produced. h3's iterable sends each
 * chunk a generator yields as it is yielded, and its length is never known, so it goes out chunked.
 */
const stream: Routes = (app, p) => {
  app.get("/stream/items", (event) => {
    event.res.headers.set("content-type", "application/x-ndjson");
    return iterable(lines(p.medium.items));
  });
};

export default stream;
