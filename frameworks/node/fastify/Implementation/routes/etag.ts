// rb:wiring etag.*
import etag from "@fastify/etag";

import type { Routes } from "../app.ts";
import { answers, payload } from "../schemas.ts";
import { fresh } from "../serial.ts";

/**
 * etag: @fastify/etag, registered in this family's plugin. It hashes the body Fastify is about to
 * send, writes the tag, and answers 304 itself when If-None-Match names it. The body is built and
 * hashed before anything is compared, so a 304 saves the write and nothing else.
 */
const etags: Routes = async (app, { payloads: p }) => {
  // rb:wiring etag.*
  // Its onSend hook runs on these two routes and on no other. The hash is the plugin's default, SHA-1.
  await app.register(etag);

  app.get("/etag/small", answers(payload), async (_request, reply) => fresh(reply, p.small));

  app.get("/etag/large", answers(payload), async (_request, reply) => fresh(reply, p.large));
};

export default etags;
