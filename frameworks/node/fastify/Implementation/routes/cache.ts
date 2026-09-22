import type { FastifyReply, FastifyRequest } from "fastify";

import type { Routes } from "../app.ts";
import type { Payload } from "../payloads.ts";
import { answers, payload } from "../schemas.ts";
import { fresh } from "../serial.ts";

declare module "fastify" {
  interface FastifyContextConfig {
    /** The request headers a cache route's answer varies on, which are part of its key. */
    readonly vary?: readonly string[];
  }
}

/** An answer as the handler's reply left it: its headers and the body Fastify serialised. */
interface Stored {
  readonly headers: ReturnType<FastifyReply["getHeaders"]>;
  readonly body: string;
  readonly expires: number;
}

/**
 * cache: the handler skipped and a stored answer written back. The handler writes x-rb-serial,
 * so a replayed answer repeats the serial it was stored with.
 */
const cache: Routes = async (app, { payloads: p }) => {
  const { capacity, ttlSeconds, vary } = p.settings.cache;
  const one = Object.keys(vary.one);
  const many = Object.keys(vary.many);

  // rb:wiring cache.*
  /**
   * Fastify ships no response cache, and @fastify/caching sets cache headers and hands out a
   * store without replaying anything. The replay is two hooks in this family's plugin, so they
   * run on these routes alone: onRequest answers from the store before the handler, and onSend
   * stores what the handler's reply serialised. The store holds settings.json's capacity in
   * entries, and drops the oldest to make room.
   */
  const store = new Map<string, Stored>();

  const keyOf = (request: FastifyRequest): string => {
    let key = request.url;
    for (const header of request.routeOptions.config.vary ?? []) key += `\n${request.headers[header] ?? ""}`;
    return key;
  };

  const lookup = (key: string): Stored | undefined => {
    const hit = store.get(key);
    if (hit !== undefined && hit.expires <= Date.now()) {
      store.delete(key);
      return undefined;
    }
    return hit;
  };

  app.addHook("onRequest", (request, reply, done) => {
    const hit = lookup(keyOf(request));
    if (hit === undefined) done();
    else reply.headers(hit.headers).send(hit.body);
  });

  app.addHook("onSend", (request, reply, body, done) => {
    const key = keyOf(request);
    if (reply.statusCode === 200 && typeof body === "string" && lookup(key) === undefined) {
      if (store.size >= capacity) store.delete(store.keys().next().value!);
      store.set(key, { headers: reply.getHeaders(), body, expires: Date.now() + ttlSeconds * 1000 });
    }
    done(null, body);
  });
  // rb:end

  app.get("/cache/small", answers(payload), async (_request, reply) => stored(reply, p.small));

  app.get("/cache/medium", answers(payload), async (_request, reply) => stored(reply, p.medium));

  app.get("/cache/large", answers(payload), async (_request, reply) => stored(reply, p.large));

  app.get("/cache/vary/one", { ...answers(payload), config: { vary: one } }, async (_request, reply) => stored(reply, p.small, one));

  app.get("/cache/vary/many", { ...answers(payload), config: { vary: many } }, async (_request, reply) => stored(reply, p.small, many));
};

/**
 * The Vary header tells a cache in front of the framework what the answer depends on. The store
 * keys on the route's config, not on this header.
 */
function stored(reply: FastifyReply, answer: Payload, vary?: readonly string[]): Payload {
  if (vary !== undefined) reply.header("vary", vary.join(", "));
  return fresh(reply, answer);
}

export default cache;
