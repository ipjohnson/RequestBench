// query: query string parsing and coercion, isolated from any use of the values.
//
// Express parses req.query, which is the work this family measures; the domain coerces
// what it parsed, so every target in the language answers the same values.
import * as d from "../../_shared/domain.js";

export default function query(app) {
  app.get("/query/one", (req, res) => res.json(d.coerceOne(req.query)));

  app.get("/query/many", (req, res) => res.json(d.coerceMany(req.query)));
}
