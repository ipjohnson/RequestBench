// rb:wiring cache.*
// cache: Hono's own cache middleware.
//
// hono/cache builds the key, folds in the headers named by vary, checks cache-control and
// stores the whole Response. What it needs and Node does not have is the platform half: it
// calls caches.open(), and there is no Cache API in Node. The shim below is that store and
// nothing more, so the middleware's own key construction and vary handling are what run.
//
// wait: true because the middleware otherwise defers the write to executionCtx.waitUntil,
// which no Node host provides.
import { cache as cacheMiddleware } from "hono/cache";
// rb:wiring cache.*
import { LRUCache } from "lru-cache";

import * as d from "../../_shared/domain.js";

// rb:wiring cache.*
// One store for the target, so the capacity the fixture derives from the key count means
// what it says. Keyed by the URL hono/cache builds, which already carries the vary values.
const store = new LRUCache({ max: d.CACHE_MAX, ttl: d.CACHE_TTL_MS });

// rb:wiring cache.*
globalThis.caches ??= {
  open: async () => ({
    match: async (key) => {
      const hit = store.get(String(key));
      return hit ? new Response(hit.body, { status: hit.status, headers: hit.headers }) : undefined;
    },
    put: async (key, response) => {
      store.set(String(key), {
        status: response.status,
        headers: [...response.headers],
        body: await response.arrayBuffer(),
      });
    },
  }),
};

export default function cache(app) {
  const name = "rb";
  for (const size of ["small", "medium", "large"]) {
    app.use("/cache/" + size, cacheMiddleware({ cacheName: name, wait: true }));
  }
  for (const which of ["one", "many"]) {
    app.use("/cache/vary/" + which,
      cacheMiddleware({ cacheName: name, wait: true, vary: d.varyOn(which) }));
  }
  // rb:handler cache.small,cache.medium,cache.large
  for (const size of ["small", "medium", "large"]) {
    app.get("/cache/" + size, (c) => {
      c.header("x-rb-serial", d.nextSerial());
      return c.json(d.payload(size));
    });
  }
  // rb:handler cache.vary_one,cache.vary_many
  for (const which of ["one", "many"]) {
    const on = d.varyOn(which);
    app.get("/cache/vary/" + which, (c) => {
      c.header("vary", on.join(", "));
      c.header("x-rb-serial", d.nextSerial());
      return c.json(d.payload("small"));
    });
  }
}
