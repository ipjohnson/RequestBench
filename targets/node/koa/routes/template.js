// template: server-side rendering of the same model the json family serializes.
//
// Koa ships no view layer. @koa/ejs is the koajs organisation's own render middleware, and
// it installs ctx.render, so the handler names a template rather than calling a render
// function. EJS is the most used template engine on npm by a wide margin, which is where a
// framework with no recommendation of its own leaves the choice.
import render from "@koa/ejs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import * as d from "../../_shared/domain.js";

const VIEWS = join(dirname(dirname(fileURLToPath(import.meta.url))), "views");

export default function template(router, { app }) {
  // Compiled on first render and cached, rendered per request. A precomputed string would
  // measure nothing.
  // layout: false because @koa/ejs wraps every view in layout.ejs by default, and this
  // endpoint renders one page rather than a page inside a shell.
  render(app, { root: VIEWS, layout: false, viewExt: "ejs", cache: true, async: false });

  router.get("/template/small", async (ctx) => {
    await ctx.render("items", d.payload("small"));
  });

  router.get("/template/medium", async (ctx) => {
    await ctx.render("items", d.payload("medium"));
  });
}
