import type { Routes } from "../app.ts";

/** baseline: the dispatch floor, with nothing serialised. res.send writes a string as text/html unless the type is set. */
const baseline: Routes = (app) => {
  app.get("/plaintext", (_request, response) => response.type("text/plain").send("Hello, World!"));
};

export default baseline;
