// template: server-side rendering of the same model the json family serializes.
//
// Hono's own view facility, and the only one in the set that needs no dependency at all:
// `html` from hono/html is a template-literal tag that escapes every interpolation, and
// c.html sends what it returns. Hono ships it in core and documents it, alongside JSX, as
// how to render HTML.
// rb:wiring template.*
import { html } from "hono/html";

import * as d from "../../_shared/domain.js";

// Rendered per request. A precomputed string would measure nothing.
// rb:wiring template.*
const items = (b) => html`<!doctype html>
<html>
  <head><title>items</title></head>
  <body>
    <h1>${b.size}</h1>
    <table>
      <thead>
        <tr><th>id</th><th>name</th><th>category</th><th>price</th><th>stock</th></tr>
      </thead>
      <tbody>
        ${b.items.map((it) => html`
        <tr>
          <td>${it.id}</td>
          <td>${it.name}</td>
          <td>${it.category}</td>
          <td>${it.price_cents}</td>
          <td>${it.in_stock ? "yes" : "no"}</td>
        </tr>`)}
      </tbody>
    </table>
    <p>${b.count} rows</p>
  </body>
</html>`;

export default function template(app) {
  app.get("/template/small", (c) => c.html(items(d.payload("small"))));

  app.get("/template/medium", (c) => c.html(items(d.payload("medium"))));
}
