import { join } from "node:path";

// rb:wiring template.*
import view from "@fastify/view";
import ejs from "ejs";

import type { Routes } from "../app.ts";

/**
 * template: Fastify has no view layer of its own. @fastify/view is the Fastify team's plugin for
 * one, and EJS is the engine its documentation leads with.
 */
const template: Routes = async (app, { payloads: p }) => {
  // rb:wiring template.*
  // The plugin compiles a template on its first render and keeps it when NODE_ENV is production,
  // which the image sets.
  await app.register(view, { engine: { ejs }, root: join(import.meta.dirname, "..", "views") });

  app.get("/template/small", async (_request, reply) => reply.viewAsync("items.ejs", p.small));

  app.get("/template/medium", async (_request, reply) => reply.viewAsync("items.ejs", p.medium));
};

export default template;
