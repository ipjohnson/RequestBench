import type { Routes } from "../app.ts";

/** baseline: the dispatch floor, with nothing serialised. Fastify sends a string as text/plain. */
const baseline: Routes = async (app) => {
  app.get("/plaintext", async () => "Hello, World!");
};

export default baseline;
