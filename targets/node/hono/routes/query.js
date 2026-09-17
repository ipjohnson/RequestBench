// query: query string parsing and coercion, isolated from any use of the values.
//
// Hono has no typed query binder, but validator("query", fn) is where a query check belongs
// in it: a route-level hook that reads c.req.query(), hands the values to the check and
// short circuits if the check answers with a Response. The coercion is this target's own,
// and Hono decides when it runs; the handler reads the result back with
// c.req.valid("query") and coerces nothing itself.
//
// This is this target's copy on purpose. Sharing one coercer across five frameworks
// measured the shared function rather than the framework, which is the defect #37 describes.
import { validator } from "hono/validator";

// rb:wiring query.*
const int = (v) => { const n = Number(v); return Number.isInteger(n) ? n : 0; };
const str = (v) => v ?? null;

// rb:wiring query.*
const bindsOne = validator("query", (q) => ({ page: int(q.page) }));

// rb:wiring query.*
const bindsMany = validator("query", (q) => ({
  page: int(q.page), size: int(q.size), status: str(q.status),
  category: str(q.category), sort: str(q.sort), q: str(q.q),
  min_price: int(q.min_price), max_price: int(q.max_price),
}));

// rb:wiring domain.*
/** What domain.filter pages by. */
export const bindsFilter = validator("query", (q) => ({
  page: int(q.page), size: int(q.size), status: str(q.status),
}));

export default function query(app) {
  app.get("/query/one", bindsOne, (c) => c.json(c.req.valid("query")));

  app.get("/query/many", bindsMany, (c) => c.json(c.req.valid("query")));
}
