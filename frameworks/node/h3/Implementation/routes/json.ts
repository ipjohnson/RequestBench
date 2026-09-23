import type { Routes } from "../app.ts";

/** json: a payload the framework already holds, which h3 writes with JSON.stringify. */
const json: Routes = (app, p) => {
  app.get("/json/small", () => p.small);

  app.get("/json/medium", () => p.medium);

  app.get("/json/large", () => p.large);
};

export default json;
