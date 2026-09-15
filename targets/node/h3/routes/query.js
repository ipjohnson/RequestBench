// query: query string parsing and coercion, isolated from any use of the values.
//
// h3 parses getQuery(e), which is the work this family measures; the domain coerces what
// it parsed, so every target in the language answers the same values.
import { getQuery } from "h3";

import * as d from "../../_shared/domain.js";

export default function query(app) {
  app.get("/query/one", (e) => d.coerceOne(getQuery(e)));

  app.get("/query/many", (e) => d.coerceMany(getQuery(e)));
}
