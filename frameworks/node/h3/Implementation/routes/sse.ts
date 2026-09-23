import { EventStream } from "h3";

import type { Routes } from "../app.ts";
import type { Item } from "../payloads.ts";

// rb:wiring sse.*
/**
 * Each row as the data of one event, pushed after the handler has returned the stream, because a
 * push waits for the response to read what the last one wrote.
 */
async function send(stream: EventStream, rows: readonly Item[]): Promise<void> {
  for (const row of rows) await stream.push({ data: JSON.stringify(row) });
  await stream.close();
}
// rb:end

/**
 * sse: items.medium's rows as server-sent events, through h3's EventStream, which the handler returns
 * as the response. It writes each event as it is pushed and ends the response when it is closed.
 */
const sse: Routes = (app, p) => {
  app.get("/sse/medium", (event) => {
    // rb:wiring sse.*
    const stream = new EventStream(event);
    void send(stream, p.medium.items);
    return stream;
  });
};

export default sse;
