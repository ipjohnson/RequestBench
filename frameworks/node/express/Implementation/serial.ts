import type { Response } from "express";

let last = 0;

/**
 * x-rb-serial: the Unix time in milliseconds, a bar, and one counter for the whole process. A
 * handler that writes it increments the counter and writes both, so an answer the cache family
 * replays carries the value it was stored with.
 */
export function serial(response: Response): Response {
  return response.set("x-rb-serial", `${Date.now()}|${++last}`);
}
