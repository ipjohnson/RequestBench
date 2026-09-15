// authorized: the framework's authorization mechanism, crypto excluded.
//
// Route-scoped middleware, not an if in the handler. An if would measure the language;
// the point of the family is the framework's own plumbing.
import { defineHandler } from "h3";

import * as d from "../../_shared/domain.js";

const requireToken = (e, next) => {
  if (d.tokenOk(e.req.headers.get("authorization"))) return next();
  e.res.status = 403;
  return d.forbiddenBody();
};

export default function authorized(app) {
  app.get("/authorized/small", defineHandler({
    middleware: [requireToken],
    handler: () => d.payload("small"),
  }));
}
