import type { H3Event } from "h3";

let last = 0;

/**
 * x-rb-serial: one counter for the whole process. A handler that writes it increments it and
 * stages the new value on the response, so an answer the cache family replays carries the value it
 * was stored with.
 */
export function fresh<T>(event: H3Event, answer: T): T {
  event.res.headers.set("x-rb-serial", String(++last));
  return answer;
}
