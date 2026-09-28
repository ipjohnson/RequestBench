let last = 0;

/**
 * x-rb-serial: the Unix time in milliseconds, a bar, and one counter for the whole process. A
 * handler that writes it takes the next count, so an answer the cache family replays carries the
 * value it was stored with.
 */
export function serial(): string {
  return `${Date.now()}|${++last}`;
}
