// rb:wiring compressed.*
import compress from "@fastify/compress";

import type { Routes } from "../app.ts";
import { answers, payload } from "../schemas.ts";
import { fresh } from "../serial.ts";

/**
 * compressed: these routes answer like any other, and @fastify/compress, registered in this
 * family's plugin, gzips the answer when the request asks for it.
 */
const compressed: Routes = async (app, { payloads: p }) => {
  // rb:wiring compressed.*
  // Its onSend hook runs on these two routes and on no other. The threshold is the plugin's
  // default, so a body under 1 KB goes out as it is, and the level is the fastest zlib offers,
  // which every framework here compresses at.
  await app.register(compress, { zlibOptions: { level: 1 } });

  app.get("/compressed/small", answers(payload), async (_request, reply) => fresh(reply, p.small));

  app.get("/compressed/large", answers(payload), async (_request, reply) => fresh(reply, p.large));
};

export default compressed;
