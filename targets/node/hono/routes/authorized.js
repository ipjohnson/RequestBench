// authorized: the framework's authorization mechanism, crypto excluded.
//
// Route-scoped middleware, not an if in the handler. An if would measure the language;
// the point of the family is the framework's own plumbing.
import * as d from "../../_shared/domain.js";

// rb:wiring authorized.*
const requireToken = async (c, next) => {
  if (!d.tokenOk(c.req.header("authorization"))) return c.json(d.forbiddenBody(), 403);
  await next();
};

export default function authorized(app) {
  app.get("/authorized/small", requireToken, (c) => c.json(d.payload("small")));
}
