// rb:wiring cache.*
// cache: koa-cash, the response cache the Koa organisation ships.
//
// The store is an LRU sized from the fixture, and koa-cash's own hash() builds the key, so
// the vary rows fold their header values into it the way the middleware intends. A route
// opts in by calling ctx.cashed(), which is koa-cash's whole interface: the handler is
// entered on a hit and returns before doing any work, rather than not being reached at all.
// That is a real difference from an output cache that answers ahead of the router, and it
// is one of the reasons this family is not comparable across frameworks.
//
// koa-cash stores the body, its type, last-modified and etag, and nothing else, so the
// freshness counter cannot ride along inside it. It is kept beside the store under the same
// key: what it has to prove is that the response was not built again, and reading it back
// rather than incrementing it is exactly that.
import koaCash from "koa-cash";
import { LRUCache } from "lru-cache";

import * as d from "../../_shared/domain.js";

// rb:wiring cache.*
const store = new LRUCache({ max: d.CACHE_MAX, ttl: d.CACHE_TTL_MS });
const serials = new LRUCache({ max: d.CACHE_MAX, ttl: d.CACHE_TTL_MS });

/** The headers each route is keyed on, beyond the url koa-cash hashes by default. */
const varyBy = new Map();

// rb:wiring cache.*
const cash = koaCash({
  maxAge: d.CACHE_TTL_MS,
  hash: (ctx) => {
    const on = varyBy.get(ctx.path) ?? [];
    return on.length === 0 ? ctx.path
      : ctx.path + "|" + on.map((h) => ctx.headers[h] ?? "").join("|");
  },
  get: (key) => store.get(key),
  set: (key, value) => { store.set(key, value); },
});

/** Answer from the store if it holds this key, carrying the counter that key was built with. */
async function replayed(ctx) {
  if (!(await ctx.cashed())) return false;
  ctx.set("x-rb-serial", String(serials.get(ctx.cashKey)));
  return true;
}

// rb:wiring cache.*
function built(ctx, body) {
  const serial = d.nextSerial();
  serials.set(ctx.cashKey, serial);
  ctx.set("x-rb-serial", serial);
  ctx.body = body;
}

export default function cache(router, { app }) {
  // rb:wiring cache.*
  app.use(cash);
  // rb:handler cache.small,cache.medium,cache.large
  for (const size of ["small", "medium", "large"]) {
    router.get("/cache/" + size, async (ctx) => {
      if (await replayed(ctx)) return;
      built(ctx, d.payload(size));
    });
  }
  // rb:handler cache.vary_one,cache.vary_many
  for (const which of ["one", "many"]) {
    const on = d.varyOn(which);
    varyBy.set("/cache/vary/" + which, on);
    router.get("/cache/vary/" + which, async (ctx) => {
      ctx.set("vary", on.join(", "));
      if (await replayed(ctx)) return;
      built(ctx, d.payload("small"));
    });
  }
}
