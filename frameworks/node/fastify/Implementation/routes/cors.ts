// rb:wiring cors.*
import fastifyCors from "@fastify/cors";

import type { Routes } from "../app.ts";
import { answers, payload } from "../schemas.ts";
import { fresh } from "../serial.ts";

/**
 * cors: @fastify/cors, registered in this family's plugin, which app.ts mounts under /cors. Its
 * onRequest hook answers a preflight before any handler runs, and adds its headers to the request
 * itself. The handler writes x-rb-serial, so its absence on a preflight shows the plugin answered alone.
 */
const cors: Routes = async (app, { payloads: p }) => {
  const { origin, method, header, maxAgeSeconds } = p.settings.cors;

  // rb:wiring cors.*
  // The origin as a list of one. @fastify/cors writes a string origin on every answer, whatever
  // origin asked, and checks the request's origin against a list, adding Vary: Origin.
  await app.register(fastifyCors, { origin: [origin], methods: [method], allowedHeaders: [header], maxAge: maxAgeSeconds });

  // rb:handler cors.request
  app.get("/small", answers(payload), async (_request, reply) => fresh(reply, p.small));
};

export default cors;
