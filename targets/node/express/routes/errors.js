// errors: router miss, handler 404 and parser failure.
//
// Registered last. Express matches in registration order, so a catch-all 404 mounted
// earlier would answer every route declared after it.
import * as d from "../../_shared/domain.js";
import { notBound } from "../validation.js";

export default function errors(app) {
  // rb:handler errors.unmatched
  app.use((_, res) => res.status(404).json(d.notFoundBody()));

  // express.json() raises a SyntaxError on a body it cannot parse. That never reached the
  // walk, so it names no field and answers 400; a body that parsed and then failed the walk
  // answers 422 where the walk itself is.
  // rb:wiring errors.*
  app.use((err, _req, res, _next) => {
    if (err instanceof SyntaxError) return res.status(400).json(notBound(err.message));
    return res.status(500).json({ error: "internal", message: err.message });
  });
}
