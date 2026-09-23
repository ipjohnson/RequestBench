import type { Routes } from "../app.ts";

/** baseline: the dispatch floor, with nothing serialised. c.text sends the string as text/plain. */
const baseline: Routes = (app) => {
  app.get("/plaintext", (c) => c.text("Hello, World!"));
};

export default baseline;
