import sensible from "@fastify/sensible";
import Fastify, { type FastifyInstance, type FastifyPluginAsync } from "fastify";

import type { Payloads } from "./payloads.ts";
import authorized from "./routes/authorized.ts";
import baseline from "./routes/baseline.ts";
import body from "./routes/body.ts";
import cache from "./routes/cache.ts";
import compressed from "./routes/compressed.ts";
import contract from "./routes/contract.ts";
import cors from "./routes/cors.ts";
import etag from "./routes/etag.ts";
import forms from "./routes/forms.ts";
import headers from "./routes/headers.ts";
import items from "./routes/items.ts";
import json from "./routes/json.ts";
import middleware from "./routes/middleware.ts";
import parameters from "./routes/parameters.ts";
import query from "./routes/query.ts";
import sse from "./routes/sse.ts";
import files from "./routes/static.ts";
import stream from "./routes/stream.ts";
import template from "./routes/template.ts";

/** One family's routes, and whatever that family installs, as a plugin of its own. */
export type Routes = FastifyPluginAsync<{ readonly payloads: Payloads }>;

/**
 * The application, built and not listening, so the suite can inject requests into it.
 *
 * Each family is a plugin. Fastify encapsulates a plugin, so a hook, a body parser or a plugin a
 * family registers applies to that family's routes and to no others. The errors family has no
 * routes: its answers are the router's, the JSON parser's and the items handlers'.
 *
 * Client/document.ts passes an instance with @fastify/swagger already registered, because it
 * collects routes as they are added.
 */
export async function build(payloads: Payloads, app: FastifyInstance = Fastify()): Promise<FastifyInstance> {
  // @fastify/sensible decorates every reply with Fastify's HTTP errors, reply.notFound and
  // reply.forbidden among them, which the default error handler writes.
  await app.register(sensible);
  for (const family of [contract, authorized, baseline, body, cache, compressed, etag, forms, headers, items, json, middleware, parameters, query, sse, files, stream, template]) {
    await app.register(family, { payloads });
  }
  // Under a prefix, because @fastify/cors registers a catch-all OPTIONS route for preflights,
  // and the prefix keeps that route to /cors.
  await app.register(cors, { payloads, prefix: "/cors" });
  return app;
}
