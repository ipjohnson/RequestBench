// rb:wiring sse.*
import { fastifySSE } from "@fastify/sse";

import type { Routes } from "../app.ts";
import type { Item } from "../payloads.ts";
import { serializeItem } from "../schemas.ts";

/** Each row as the data of one event. */
async function* events(rows: readonly Item[]): AsyncGenerator<{ data: Item }> {
  for (const row of rows) yield { data: row };
}

/**
 * sse: items.medium's rows as server-sent events, through @fastify/sse, the Fastify team's plugin
 * for them. It writes each event to the response as it comes and ends the response when the
 * handler returns.
 */
const sse: Routes = async (app, { payloads: p }) => {
  // rb:wiring sse.*
  // Registered in this family's plugin, so its onRoute hook wraps this route and no other. The
  // serializer writes each event's data with the function the json rows' item schema compiles to.
  await app.register(fastifySSE);

  app.get("/sse/medium", { sse: { kind: "only", serializer: serializeItem } }, async (_request, reply) => {
    await reply.sse.send(events(p.medium.items));
  });
};

export default sse;
