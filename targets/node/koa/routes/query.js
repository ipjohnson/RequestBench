// query: query string parsing and coercion, isolated from any use of the values.
//
// Koa parses ctx.query, which is the work this family measures; the domain coerces what it
// parsed, so every target in the language answers the same values.
import * as d from "../../_shared/domain.js";

export default function query(router) {
  router.get("/query/one", (ctx) => { ctx.body = d.coerceOne(ctx.query); });

  router.get("/query/many", (ctx) => { ctx.body = d.coerceMany(ctx.query); });
}
