// rb:wiring static.*
import fastifyStatic from "@fastify/static";

import type { Routes } from "../app.ts";

/** static: @fastify/static, registered in this family's plugin, serving the payload directory. */
const files: Routes = async (app, { payloads: p }) => {
  // rb:handler static.file
  // rb:wiring static.*
  await app.register(fastifyStatic, { root: p.directory, prefix: "/static/" });
};

export default files;
