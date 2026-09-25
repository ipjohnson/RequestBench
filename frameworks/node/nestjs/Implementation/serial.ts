let last = 0;

/**
 * x-rb-serial: one counter for the whole process. A handler that writes it takes the next value,
 * so an answer the cache family replays carries the value it was stored with.
 */
export function serial(): string {
  return String(++last);
}
