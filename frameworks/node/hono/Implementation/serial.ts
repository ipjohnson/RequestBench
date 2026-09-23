import type { Context } from "hono";

import type { Payload } from "./payloads.ts";

let last = 0;

/**
 * The payload as JSON, with x-rb-serial written to show the handler ran for it. The counter is one
 * for the whole process: a handler that writes it increments it and writes the new value, so an
 * answer the cache family replays carries the value it was stored with.
 */
export function fresh(c: Context, answer: Payload): Response {
  c.header("x-rb-serial", String(++last));
  return c.json(answer);
}
