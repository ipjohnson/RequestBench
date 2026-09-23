import type { Routes } from "../app.ts";

/** json: a payload the framework already holds, written by res.json, which serialises it with JSON.stringify. */
const json: Routes = (app, p) => {
  app.get("/json/small", (_request, response) => response.json(p.small));

  app.get("/json/medium", (_request, response) => response.json(p.medium));

  app.get("/json/large", (_request, response) => response.json(p.large));
};

export default json;
