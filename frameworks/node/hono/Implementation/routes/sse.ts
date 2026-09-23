// rb:wiring sse.*
import { streamSSE } from "hono/streaming";

import type { Routes } from "../app.ts";

/**
 * sse: items.medium's rows as server-sent events, through streamSSE from Hono's streaming helper.
 * It writes each event to the response as it comes and ends the response when the callback returns.
 */
const sse: Routes = (app, p) => {
  app.get("/sse/medium", (c) =>
    streamSSE(c, async (events) => {
      for (const row of p.medium.items) await events.writeSSE({ data: JSON.stringify(row) });
    }));
};

export default sse;
