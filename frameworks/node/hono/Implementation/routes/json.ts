import type { Routes } from "../app.ts";

/** json: a payload the framework already holds, written by c.json with JSON.stringify. */
const json: Routes = (app, p) => {
  app.get("/json/small", (c) => c.json(p.small));

  app.get("/json/medium", (c) => c.json(p.medium));

  app.get("/json/large", (c) => c.json(p.large));
};

export default json;
