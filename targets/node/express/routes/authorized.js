// authorized: the framework's authorization mechanism, crypto excluded.
//
// Route-scoped middleware, not an if in the handler. An if would measure the language;
// the point of the family is the framework's own plumbing.
import * as d from "../../_shared/domain.js";

const requireToken = (req, res, next) =>
  d.tokenOk(req.headers.authorization) ? next() : res.status(403).json(d.forbiddenBody());

export default function authorized(app) {
  app.get("/authorized/small", requireToken, (_, res) => res.json(d.payload("small")));
}
