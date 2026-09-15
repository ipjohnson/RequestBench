// template: server-side rendering of the same model the json family serializes.
//
// The engine is handlebars, shared with every other Node target and named on /__meta.
import { renderItems } from "../../_shared/template.js";
import * as d from "../../_shared/domain.js";

export default function template(app) {
  app.get("/template/small", (c) => c.html(renderItems(d.payload("small"))));

  app.get("/template/medium", (c) => c.html(renderItems(d.payload("medium"))));
}
