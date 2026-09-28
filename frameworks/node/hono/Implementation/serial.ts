import type { Context } from "hono";

import type { Payload } from "./payloads.ts";

let last = 0;

/**
 * The payload as JSON, with x-rb-serial written to show the handler ran for it: the Unix time in
 * milliseconds, a bar, and one counter for the whole process. A handler that writes it increments
 * the counter and writes both, so an answer the cache family replays carries the value it was
 * stored with.
 */
export function fresh(c: Context, answer: Payload): Response {
  c.header("x-rb-serial", `${Date.now()}|${++last}`);
  return c.json(answer);
}
