import type { Routes } from "../app.ts";

/** baseline: the dispatch floor, with nothing serialised. h3 sends a returned string as text/plain. */
const baseline: Routes = (app) => {
  app.get("/plaintext", () => "Hello, World!");
};

export default baseline;
