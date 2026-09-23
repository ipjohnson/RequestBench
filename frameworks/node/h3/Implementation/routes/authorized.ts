import { HTTPError, type Middleware } from "h3";

import type { Routes } from "../app.ts";

// rb:wiring authorized.*
/**
 * The token check, as middleware on the route, which h3 runs before the handler. h3's own
 * authentication is Basic only, so the bearer token is compared here. Any other token is refused by
 * throwing h3's HTTPError with 403, which h3's error handling writes.
 */
function requireToken(token: string): Middleware {
  const accepted = `Bearer ${token}`;
  return (event, next) => {
    if (event.req.headers.get("authorization") === accepted) return next();
    throw HTTPError.status(403, "Forbidden");
  };
}
// rb:end

/** authorized: h3 has no bearer authorization of its own, so the check is middleware on the route. */
const authorized: Routes = (app, p) => {
  app.get("/authorized/small", () => p.small, { middleware: [requireToken(p.settings.token)] });
};

export default authorized;
