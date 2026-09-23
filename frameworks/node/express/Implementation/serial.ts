import type { Response } from "express";

let last = 0;

/**
 * x-rb-serial: one counter for the whole process. A handler that writes it increments it and
 * writes the new value, so an answer the cache family replays carries the value it was stored with.
 */
export function serial(response: Response): Response {
  return response.set("x-rb-serial", String(++last));
}
