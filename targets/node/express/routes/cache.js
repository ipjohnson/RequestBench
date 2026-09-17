// rb:wiring cache.*
// cache: the handler skipped and a stored response replayed.
//
// Express ships no response cache and no store. The package the ecosystem reaches for,
// apicache, has not been released since Express 4 and never returns a first response under
// Express 5, so what runs here is Express's own middleware chain over lru-cache: the whole
// response is captured on the way out and written back verbatim on a hit, which is what
// makes x-rb-serial repeat and prove the handler did not run.
//
// One store for the target rather than one per route, so the capacity the fixture derives
// from the key count means what it says.
import { LRUCache } from "lru-cache";

import * as d from "../../_shared/domain.js";

// rb:wiring cache.*
const store = new LRUCache({ max: d.CACHE_MAX, ttl: d.CACHE_TTL_MS });

// rb:wiring cache.*
/** The path, plus the value of each header this route is keyed on. */
const keyOf = (on) => (req) =>
  on.length === 0 ? req.path : req.path + "|" + on.map((h) => req.headers[h] ?? "").join("|");

// rb:wiring cache.*
function cached(on) {
  const key = keyOf(on);
  return (req, res, next) => {
    const hit = store.get(key(req));
    if (hit) {
      res.writeHead(hit.status, hit.headers);
      return res.end(hit.body);
    }
    const chunks = [];
    const write = res.write.bind(res);
    const end = res.end.bind(res);
    res.write = (chunk, ...rest) => {
      if (chunk) chunks.push(Buffer.from(chunk));
      return write(chunk, ...rest);
    };
    res.end = (chunk, ...rest) => {
      if (chunk && typeof chunk !== "function") chunks.push(Buffer.from(chunk));
      if (res.statusCode === 200) {
        store.set(key(req), { status: 200, headers: res.getHeaders(),
                              body: Buffer.concat(chunks) });
      }
      return end(chunk, ...rest);
    };
    next();
  };
}

export default function cache(app) {
  // rb:handler cache.small,cache.medium,cache.large
  for (const size of ["small", "medium", "large"]) {
    app.get("/cache/" + size, cached([]), (_, res) => {
      res.set("x-rb-serial", d.nextSerial()).json(d.payload(size));
    });
  }
  // rb:handler cache.vary_one,cache.vary_many
  for (const which of ["one", "many"]) {
    const on = d.varyOn(which);
    app.get("/cache/vary/" + which, cached(on), (_, res) => {
      res.set({ vary: on.join(", "), "x-rb-serial": d.nextSerial() });
      res.json(d.payload("small"));
    });
  }
}
