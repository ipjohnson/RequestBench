import type { Context, Middleware } from "koa";
// rb:wiring cache.*
import koaCash from "koa-cash";
import { LRUCache } from "lru-cache";

import type { Routes } from "../app.ts";
import type { Payload } from "../payloads.ts";
import { serial } from "../serial.ts";

declare module "koa" {
  interface BaseContext {
    /** The key ctx.cashed() computed with koa-cash's hash option. koa-cash sets it, and its types leave it out. */
    cashKey: string;
  }
}

/**
 * cache: koa-cash, the Koa organisation's response cache. The handler writes x-rb-serial, so a
 * replayed answer repeats the serial it was stored with.
 */
const cache: Routes = (router, { payloads: p }) => {
  const { capacity, ttlSeconds, vary } = p.settings.cache;
  const one = Object.keys(vary.one);
  const many = Object.keys(vary.many);

  // rb:wiring cache.*
  /**
   * koa-cash as route middleware on these routes alone. A handler calls ctx.cashed(): on a hit
   * koa-cash has set the stored answer and the handler returns at once, and on a miss the handler
   * answers and koa-cash stores what it answered once the handler has returned. The store is an
   * lru-cache, as koa-cash's own example has it, holding settings.json's capacity in entries.
   *
   * koa-cash stores the body, its type, Last-Modified and ETag, and no other header. The serial each
   * answer was built with is kept beside it under the same key, and a replay writes it back.
   */
  const store = new LRUCache<string, object>({ max: capacity, ttl: ttlSeconds * 1000 });
  const serials = new LRUCache<string, string>({ max: capacity, ttl: ttlSeconds * 1000 });

  /** koa-cash keyed by the path and the value of each header the route's answer varies on. */
  const cashed = (varies: readonly string[] = []): Middleware =>
    koaCash({
      maxAge: ttlSeconds * 1000,
      hash: (ctx) => varies.reduce((key, header) => `${key}\n${ctx.get(header)}`, ctx.path),
      get: async (key) => store.get(key),
      set: async (key, value) => void store.set(key, value as object),
    });

  async function stored(ctx: Context, answer: Payload, varies: readonly string[] = []): Promise<void> {
    for (const header of varies) ctx.vary(header);
    if (await ctx.cashed()) {
      ctx.set("x-rb-serial", serials.get(ctx.cashKey) ?? "");
      return;
    }
    serials.set(ctx.cashKey, serial(ctx));
    ctx.body = answer;
  }

  const byPath = cashed();
  // rb:end

  router.get("/cache/small", byPath, (ctx) => stored(ctx, p.small));

  router.get("/cache/medium", byPath, (ctx) => stored(ctx, p.medium));

  router.get("/cache/large", byPath, (ctx) => stored(ctx, p.large));

  router.get("/cache/vary/one", cashed(one), (ctx) => stored(ctx, p.small, one));

  router.get("/cache/vary/many", cashed(many), (ctx) => stored(ctx, p.small, many));
};

export default cache;
