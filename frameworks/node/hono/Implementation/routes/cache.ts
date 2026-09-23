// rb:wiring cache.*
import { cache as replay } from "hono/cache";

import type { Routes } from "../app.ts";
import { fresh } from "../serial.ts";

/** The part of the Web Cache API that hono/cache calls. */
interface Store {
  match(key: string): Promise<Response | undefined>;
  put(key: string, response: Response): Promise<void>;
}

declare global {
  /** The Web Cache API's entry point, which hono/cache reads from the global scope. */
  var caches: { open(cacheName: string): Promise<Store> } | undefined;
}

/** An answer as the store keeps it, which a hit is built again from. */
interface Stored {
  readonly status: number;
  readonly headers: [string, string][];
  readonly body: ArrayBuffer;
  readonly expires: number;
}

// rb:wiring cache.*
/**
 * hono/cache keeps answers in the Web Cache API, which Workers and Deno have and Node does not. This
 * is the part of that API it calls, caches.open and a cache's match and put, over a Map. The store
 * holds settings.json's capacity in entries, drops the oldest to make room, and lets an entry go
 * after settings.json's TTL.
 */
function storage(capacity: number, ttlSeconds: number): { open(cacheName: string): Promise<Store> } {
  const entries = new Map<string, Stored>();
  const store: Store = {
    async match(key) {
      const hit = entries.get(key);
      if (hit === undefined) return undefined;
      if (hit.expires <= Date.now()) {
        entries.delete(key);
        return undefined;
      }
      return new Response(hit.body, { status: hit.status, headers: hit.headers });
    },
    async put(key, response) {
      if (entries.size >= capacity && !entries.has(key)) entries.delete(entries.keys().next().value!);
      const body = await response.arrayBuffer();
      entries.set(key, { status: response.status, headers: [...response.headers], body, expires: Date.now() + ttlSeconds * 1000 });
    },
  };
  return { open: async () => store };
}
// rb:end

/**
 * cache: hono/cache, given on each route. It keys the store on the URL and on the request headers
 * the route names, answers a hit without running the handler, and stores a 200 the handler wrote.
 * The handler writes x-rb-serial, so a replayed answer repeats the serial it was stored with.
 */
const cache: Routes = (app, p) => {
  const { capacity, ttlSeconds, vary } = p.settings.cache;

  // rb:wiring cache.*
  globalThis.caches ??= storage(capacity, ttlSeconds);
  // wait: true stores the answer before it is sent. Without it hono/cache hands the write to the
  // platform's executionCtx.waitUntil, which Node does not have.
  const stored = (on?: string[]) => replay({ cacheName: "rb", wait: true, ...(on === undefined ? {} : { vary: on }) });
  // rb:end

  app.get("/cache/small", stored(), (c) => fresh(c, p.small));

  app.get("/cache/medium", stored(), (c) => fresh(c, p.medium));

  app.get("/cache/large", stored(), (c) => fresh(c, p.large));

  // hono/cache writes the Vary header itself, from the headers the route names.
  app.get("/cache/vary/one", stored(Object.keys(vary.one)), (c) => fresh(c, p.small));

  app.get("/cache/vary/many", stored(Object.keys(vary.many)), (c) => fresh(c, p.small));
};

export default cache;
