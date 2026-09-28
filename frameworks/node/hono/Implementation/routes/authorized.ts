import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";

import type { Routes } from "../app.ts";

// rb:wiring authorized.*
/**
 * The token check, as middleware on the route, which runs before the handler. Any other token
 * is refused by throwing Hono's HTTPException with 403, as Hono's own csrf and
 * ip-restriction middleware refuse a request, and Hono's error handler writes it.
 */
function requireToken(token: string): MiddlewareHandler {
  const accepted = `Bearer ${token}`;
  return async (c, next) => {
    if (c.req.header("authorization") !== accepted) throw new HTTPException(403, { message: "Forbidden" });
    await next();
  };
}
// rb:end

/**
 * authorized: hono/bearer-auth refuses a wrong token with 401 where the corpus asks for 403, and
 * takes no status, so the check is middleware written for the route.
 */
const authorized: Routes = (app, p) => {
  app.get("/authorized/small", requireToken("5a7cc77ed0dcb825806b6f872026c317"), (c) => c.json(p.small));
};

export default authorized;
