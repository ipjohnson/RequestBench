// cache: ocache's cached handler, which is the response cache h3 itself reaches for.
//
// h3 ships the route rule that wires it (h3/rules/cache imports defineCachedHandler from
// ocache), so this is the same store h3 would use, registered per route instead of through
// a rule table. It stores the whole Response, replays it without entering the handler, and
// builds the key itself: `varies` is what folds the header values in on the vary rows.
import { defineCachedHandler, createMemoryStorage } from "ocache";

import * as d from "../../_shared/domain.js";

// One store for the target, so the capacity the fixture derives from the key count means
// what it says.
const storage = createMemoryStorage({ maxSize: d.CACHE_MAX, maxBytes: Infinity });
const options = { storage, maxAge: d.cacheSpec.ttl_s, name: "rb" };

// A Response rather than a value: ocache stores what the handler returned, so a header set
// on event.res is written after the entry has already been built and would not be replayed.
const answer = (size) => () => new Response(JSON.stringify(d.payload(size)), {
  headers: { "content-type": "application/json", "x-rb-serial": d.nextSerial() },
});

export default function cache(app) {
  // rb:snippet cache.small cache.medium cache.large
  for (const size of ["small", "medium", "large"]) {
    app.get("/cache/" + size, defineCachedHandler(answer(size), options));
  }
  // rb:snippet cache.vary_one cache.vary_many
  for (const which of ["one", "many"]) {
    const on = d.varyOn(which);
    app.get("/cache/vary/" + which,
      defineCachedHandler(answer("small"), { ...options, varies: on }));
  }
}
