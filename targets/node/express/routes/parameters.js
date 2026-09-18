// parameters: router captures with segment depth held constant, bound as integers and echoed.
//
// A capture reaches req.params as the string the route matched. app.param is Express's own
// hook for a named capture: Express runs it once the route matches and before the handler.
// The conversion is registered there, so each handler echoes req.params already converted.
// This is this target's copy on purpose, and nothing else imports this file.
import * as d from "../../_shared/domain.js";

// rb:wiring parameters.*
const int = (v) => { const n = Number(v); return Number.isInteger(n) ? n : 0; };

export default function parameters(app) {
  // rb:wiring parameters.*
  app.param(["one", "two"], (req, _, next, value, name) => {
    req.params[name] = int(value);
    next();
  });

  // Registered ahead of the one-capture route, which also matches this path: Express
  // answers from the first route that matches.
  app.get("/parameters/static/segment/literal", (_, res) => res.json(d.payload("small")));

  app.get("/parameters/:one/segment/literal", (req, res) =>
    res.json(d.withEcho("small", req.params)));

  app.get("/parameters/:one/with-second/:two", (req, res) =>
    res.json(d.withEcho("small", req.params)));
}
