// query: query string parsing, percent-decoding and coercion, with the values echoed.
//
// Koa has no binder to plug into: ctx.query is what its query parser produced and the
// coercion is the handler's own work. This is this target's copy on purpose. Sharing one
// coercer across five frameworks measured the shared function rather than the framework,
// which is the defect #37 describes, and nothing else imports this file.
//
// A missing parameter and one that will not parse both coerce to the same value they always
// did, which is what a target with no binder can do without inventing an error contract the
// family does not have.
import * as d from "../../_shared/domain.js";

// rb:wiring query.*
const int = (v) => { const n = Number(v); return Number.isInteger(n) ? n : 0; };
const str = (v) => v ?? null;

// rb:wiring query.*
export const coerceOne = (q) => ({ page: int(q.page) });

// rb:wiring query.*
export const coerceMany = (q) => ({
  page: int(q.page), size: int(q.size), status: str(q.status),
  category: str(q.category), sort: str(q.sort), q: str(q.q),
  min_price: int(q.min_price), max_price: int(q.max_price),
});

// rb:wiring domain.*
/** What domain.filter pages by. */
export const coerceFilter = (q) => ({ page: int(q.page), size: int(q.size), status: str(q.status) });

export default function query(router) {
  router.get("/query/one", (ctx) => { ctx.body = d.withEcho("small", coerceOne(ctx.query)); });

  router.get("/query/many", (ctx) => { ctx.body = d.withEcho("small", coerceMany(ctx.query)); });
}
