// rb:wiring template.*
import { html } from "hono/html";

import type { Routes } from "../app.ts";
import type { Payload } from "../payloads.ts";

// rb:wiring template.*
/**
 * The page, rendered per request by html from hono/html: a tagged template that escapes every value
 * it interpolates, and that c.html sends. Hono's documentation offers it beside JSX, which Node's
 * type stripping cannot load.
 */
const page = (p: Payload) => html`<!doctype html>
<html>
  <head><title>items</title></head>
  <body>
    <h1>${p.size}</h1>
    <table>
      <thead>
        <tr><th>id</th><th>name</th><th>category</th><th>price</th><th>stock</th></tr>
      </thead>
      <tbody>
        ${p.items.map((it) => html`
        <tr>
          <td>${it.id}</td>
          <td>${it.name}</td>
          <td>${it.category}</td>
          <td>${it.priceCents}</td>
          <td>${it.inStock ? "yes" : "no"}</td>
        </tr>`)}
      </tbody>
    </table>
    <p>${p.count} rows</p>
  </body>
</html>`;
// rb:end

/** template: Hono has no view layer beyond its html helper and JSX, and the page is the helper's. */
const template: Routes = (app, p) => {
  app.get("/template/small", (c) => c.html(page(p.small)));

  app.get("/template/medium", (c) => c.html(page(p.medium)));
};

export default template;
