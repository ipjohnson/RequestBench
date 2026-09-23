import { readFileSync } from "node:fs";
import { join } from "node:path";

// rb:wiring template.*
import ejs from "ejs";
import { html, raw } from "h3";

import type { Routes } from "../app.ts";

/**
 * template: h3 has no view layer. Its html tag escapes what it interpolates and answers at once, so
 * it cannot build a page row by row. The template is EJS, the most used engine on npm and the one
 * Fastify's port renders, compiled once when the routes are registered and rendered on every
 * request. html(raw()) answers the page as trusted markup, as text/html.
 */
const template: Routes = (app, p) => {
  // rb:wiring template.*
  const page = ejs.compile(readFileSync(join(import.meta.dirname, "..", "views", "items.ejs"), "utf8"));

  app.get("/template/small", () => html(raw(page(p.small))));

  app.get("/template/medium", () => html(raw(page(p.medium))));
};

export default template;
