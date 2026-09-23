import { toResponse, type EventHandler } from "h3";
// rb:wiring cache.*
import { createMemoryStorage, defineCachedHandler } from "ocache";

import type { Routes } from "../app.ts";
import { fresh } from "../serial.ts";

/**
 * cache: the handler skipped and a stored answer written back. The handler writes x-rb-serial, so a
 * replayed answer repeats the serial it was stored with.
 */
const cache: Routes = (app, p) => {
  const { capacity, ttlSeconds, vary } = p.settings.cache;

  // rb:wiring cache.*
  /**
   * h3's own response cache is a route rule, and h3 runs its route rules as middleware on every
   * request. The rule is built on ocache, the unjs cache, and so is this: each cache route's handler
   * is wrapped in ocache's defineCachedHandler, which runs on that route alone. It keys an entry on
   * the path and the headers `varies` names, and names those headers in Vary. h3's toResponse turns
   * the handler's answer into the Response it stores, with the x-rb-serial the handler staged. One
   * store holds settings.json's capacity in entries, for all five routes.
   */
  const storage = createMemoryStorage({ maxSize: capacity });

  const cached = (handler: EventHandler, varies?: readonly string[]) =>
    defineCachedHandler(handler, { storage, maxAge: ttlSeconds, varies, toResponse });
  // rb:end

  app.get("/cache/small", cached((event) => fresh(event, p.small)));

  app.get("/cache/medium", cached((event) => fresh(event, p.medium)));

  app.get("/cache/large", cached((event) => fresh(event, p.large)));

  app.get("/cache/vary/one", cached((event) => fresh(event, p.small), Object.keys(vary.one)));

  app.get("/cache/vary/many", cached((event) => fresh(event, p.small), Object.keys(vary.many)));
};

export default cache;
