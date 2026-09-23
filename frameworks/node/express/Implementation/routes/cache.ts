import type { OutgoingHttpHeaders } from "node:http";

import type { RequestHandler, Response } from "express";

import type { Routes } from "../app.ts";
import type { Payload } from "../payloads.ts";
import { serial } from "../serial.ts";

/** An answer as the handler left it: its headers and the body res.send wrote. */
interface Stored {
  readonly headers: OutgoingHttpHeaders;
  readonly body: unknown;
  readonly expires: number;
}

/**
 * cache: the handler skipped and a stored answer written back. The handler writes x-rb-serial,
 * so a replayed answer repeats the serial it was stored with.
 */
const cache: Routes = (app, p) => {
  const { capacity, ttlSeconds, vary } = p.settings.cache;
  const one = Object.keys(vary.one);
  const many = Object.keys(vary.many);

  // rb:wiring cache.*
  /**
   * Express ships no response cache, and apicache, the one written for Express, was last released
   * in 2021, three years before Express 5. The replay is middleware in each cache route's handler
   * list: it answers from the store before the handler runs, or wraps res.send, through which
   * res.json writes, to store what the handler sent. The store holds settings.json's capacity in
   * entries, and drops the oldest to make room.
   */
  const store = new Map<string, Stored>();

  const lookup = (key: string): Stored | undefined => {
    const hit = store.get(key);
    if (hit !== undefined && hit.expires <= Date.now()) {
      store.delete(key);
      return undefined;
    }
    return hit;
  };

  /** Keyed by the URL and the value of each header the route's answer varies on. */
  const cached = (on: readonly string[] = []): RequestHandler => (request, response, next) => {
    let key = request.originalUrl;
    for (const header of on) key += `\n${request.headers[header] ?? ""}`;
    const hit = lookup(key);
    if (hit !== undefined) {
      response.writeHead(200, hit.headers).end(hit.body);
      return;
    }
    const send = response.send;
    response.send = (body) => {
      send.call(response, body);
      if (response.statusCode === 200 && lookup(key) === undefined) {
        if (store.size >= capacity) store.delete(store.keys().next().value!);
        store.set(key, { headers: response.getHeaders(), body, expires: Date.now() + ttlSeconds * 1000 });
      }
      return response;
    };
    next();
  };
  // rb:end

  app.get("/cache/small", cached(), (_request, response) => stored(response, p.small));

  app.get("/cache/medium", cached(), (_request, response) => stored(response, p.medium));

  app.get("/cache/large", cached(), (_request, response) => stored(response, p.large));

  app.get("/cache/vary/one", cached(one), (_request, response) => stored(response, p.small, one));

  app.get("/cache/vary/many", cached(many), (_request, response) => stored(response, p.small, many));
};

/**
 * The Vary header tells a cache in front of the framework what the answer depends on. The store
 * keys on the headers the route names, not on this header.
 */
function stored(response: Response, answer: Payload, vary?: readonly string[]): void {
  if (vary !== undefined) response.vary(vary.join(", "));
  serial(response).json(answer);
}

export default cache;
