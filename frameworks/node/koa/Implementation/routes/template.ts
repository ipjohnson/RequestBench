import { join } from "node:path";

// rb:wiring template.*
import render from "@koa/ejs";

import type { Routes } from "../app.ts";

/**
 * template: Koa has no view layer of its own. @koa/ejs is the Koa organisation's, and puts
 * ctx.render on every context, so the handler names a template.
 */
const template: Routes = (router, { payloads: p, app }) => {
  // rb:wiring template.*
  // It compiles a template on its first render and keeps it, which cache asks for. layout is off,
  // because @koa/ejs otherwise renders every view inside layout.ejs.
  render(app, { root: join(import.meta.dirname, "..", "views"), layout: false, viewExt: "ejs", cache: true });

  router.get("/template/small", async (ctx) => {
    await ctx.render("page", p.small);
  });

  router.get("/template/medium", async (ctx) => {
    await ctx.render("page", p.medium);
  });
};

export default template;
