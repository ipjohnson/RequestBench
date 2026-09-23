import { join } from "node:path";

import type { Routes } from "../app.ts";

/**
 * template: Express's own view layer. The application names a views directory and an engine, and
 * res.render names the template. Pug is the engine Express's guide to template engines uses.
 */
const template: Routes = (app, p) => {
  // rb:wiring template.*
  // Express finds and compiles a view on its first render, and keeps it when NODE_ENV is
  // production, which the image sets.
  app.set("views", join(import.meta.dirname, "..", "views"));
  app.set("view engine", "pug");
  // rb:end

  // res.render writes the response's locals into the object it is handed, so each render gets a copy.
  app.get("/template/small", (_request, response) => response.render("items", { ...p.small }));

  app.get("/template/medium", (_request, response) => response.render("items", { ...p.medium }));
};

export default template;
