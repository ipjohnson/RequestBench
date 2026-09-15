// errors: router miss, handler 404 and parser failure.
//
// Registered last. Express matches in registration order, so a catch-all 404 mounted
// earlier would answer every route declared after it.
import * as d from "../../_shared/domain.js";

export default function errors(app) {
  // rb:snippet errors.unmatched
  app.use((_, res) => res.status(404).json(d.notFoundBody()));

  // express.json() raises a SyntaxError on a body it cannot parse, and that is what
  // errors.malformed asks for. The endpoint set answers 422 there, the same status as a
  // body that parsed and failed validation, so the two contracts meet here.
  app.use((err, _req, res, _next) => {
    if (err instanceof d.ValidationError) return res.status(422).json(d.invalidBody(err.errors));
    if (err instanceof SyntaxError) return res.status(422).json(d.invalidBody(d.malformed().errors));
    return res.status(500).json({ error: "internal", message: err.message });
  });
}
