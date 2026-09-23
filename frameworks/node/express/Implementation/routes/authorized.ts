import type { RequestHandler } from "express";

import type { Routes } from "../app.ts";

// rb:wiring authorized.*
/**
 * The token check, as middleware in the route's handler list, which runs before the handler. A
 * token that is not settings.json's is refused with res.sendStatus(403), which writes the status's
 * name as a text/plain body.
 */
function requireToken(token: string): RequestHandler {
  const accepted = `Bearer ${token}`;
  return (request, response, next) => {
    if (request.headers.authorization === accepted) next();
    else response.sendStatus(403);
  };
}
// rb:end

/** authorized: Express has no authorization of its own, so the check is middleware on the route. */
const authorized: Routes = (app, p) => {
  app.get("/authorized/small", requireToken(p.settings.token), (_request, response) => response.json(p.small));
};

export default authorized;
