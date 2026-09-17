// query: query string parsing and coercion, isolated from any use of the values.
//
// getValidatedQuery is h3's own replacement for getQuery: it reads the query, hands it to
// the check and answers its own 400 HTTPError if the check throws or returns false. The
// coercion is this target's, and h3 decides when it runs and what a refusal is.
//
// This is this target's copy on purpose. Sharing one coercer across five frameworks
// measured the shared function rather than the framework, which is the defect #37 describes.
import { getValidatedQuery } from "h3";

import * as d from "../../_shared/domain.js";

// rb:wiring query.*
const int = (v) => { const n = Number(v); return Number.isInteger(n) ? n : 0; };
const str = (v) => v ?? null;

// rb:wiring query.*
const one = (q) => ({ page: int(q.page) });

// rb:wiring query.*
const many = (q) => ({
  page: int(q.page), size: int(q.size), status: str(q.status),
  category: str(q.category), sort: str(q.sort), q: str(q.q),
  min_price: int(q.min_price), max_price: int(q.max_price),
});

// rb:wiring domain.*
/** What domain.filter pages by. */
export const filter = (q) => ({ page: int(q.page), size: int(q.size), status: str(q.status) });

export default function query(app) {
  app.get("/query/one", (e) => getValidatedQuery(e, one));

  app.get("/query/many", (e) => getValidatedQuery(e, many));
}
