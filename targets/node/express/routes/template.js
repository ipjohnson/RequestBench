// template: server-side rendering of the same model the json family serializes.
//
// The engine is handlebars, shared with every other Node target and named on /__meta.
// Express's own view layer would need a second engine adapter to reach the same compiled
// template, and the engine is pinned for the same reason the gzip level is.
import { renderItems } from "../../_shared/template.js";
import * as d from "../../_shared/domain.js";

export default function template(app) {
  app.get("/template/small", (_, res) => res.type("html").send(renderItems(d.payload("small"))));

  app.get("/template/medium", (_, res) => res.type("html").send(renderItems(d.payload("medium"))));
}
