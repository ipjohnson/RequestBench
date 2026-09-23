import type { Context } from "koa";

let last = 0;

/**
 * x-rb-serial: one counter for the whole process. A handler that writes it increments it and
 * writes the new value, so an answer the cache family replays carries the value it was stored with.
 */
export function serial(ctx: Context): string {
  const value = String(++last);
  ctx.set("x-rb-serial", value);
  return value;
}

/** The answer as the body, with x-rb-serial written to show the handler ran for it. */
export function fresh(ctx: Context, answer: object): void {
  serial(ctx);
  ctx.body = answer;
}
