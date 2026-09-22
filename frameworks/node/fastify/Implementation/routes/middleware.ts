import type { FastifyReply, FastifyRequest, HookHandlerDoneFunction } from "fastify";

import type { Routes } from "../app.ts";
import { answers, payload } from "../schemas.ts";

// rb:wiring middleware.*
/**
 * A hook is Fastify's layer in front of a handler, and a route can carry hooks of its own, so
 * these run on one route and no other. onRequest is the first point in the request's lifecycle.
 */
function noop(_request: FastifyRequest, _reply: FastifyReply, done: HookHandlerDoneFunction): void {
  done();
}

const layers = (count: number) => Array.from({ length: count }, () => noop);
// rb:end

/** middleware: no-op layers in front of the handler. */
const middleware: Routes = async (app, { payloads: p }) => {
  app.get("/middleware/none", answers(payload), async () => p.small);

  app.get("/middleware/four", { ...answers(payload), onRequest: layers(4) }, async () => p.small);

  app.get("/middleware/sixteen", { ...answers(payload), onRequest: layers(16) }, async () => p.small);
};

export default middleware;
