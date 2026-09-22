import type { onRequestHookHandler } from "fastify";

import type { Routes } from "../app.ts";
import { answers, payload } from "../schemas.ts";

// rb:wiring authorized.*
/**
 * The token check, as an onRequest hook on the route, which runs before the body is read and
 * before the handler. A token that is not settings.json's is refused with 403 by
 * @fastify/sensible, whose error Fastify's error handler writes.
 */
function requireToken(token: string): onRequestHookHandler {
  const accepted = `Bearer ${token}`;
  return (request, reply, done) => {
    if (request.headers.authorization === accepted) done();
    else reply.forbidden();
  };
}
// rb:end

/**
 * authorized: Fastify has no authorization of its own, and @fastify/bearer-auth answers a wrong
 * token with 401 where the corpus asks for 403, so the check is a hook on the route.
 */
const authorized: Routes = async (app, { payloads: p }) => {
  app.get("/authorized/small", { ...answers(payload), onRequest: requireToken(p.settings.token) }, async () => p.small);
};

export default authorized;
