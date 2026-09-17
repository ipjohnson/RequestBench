// template: server-side rendering of the same model the json family serializes.
//
// Express's own view layer: an engine registered with app.set("view engine"), a views
// directory, and res.render naming the template. The handler never calls a render
// function. Pug is what express-generator scaffolds and what Express's own "Using template
// engines" guide uses, so it is what a reader of the Express docs ends up running.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import * as d from "../../_shared/domain.js";

const VIEWS = join(dirname(dirname(fileURLToPath(import.meta.url))), "views");

export default function template(app) {
  // Compiled on first render and cached by Express in production, rendered per request. A
  // precomputed string would measure nothing.
  app.set("views", VIEWS);
  app.set("view engine", "pug");

  // A copy of the payload, not the payload. res.render writes _locals into the object it
  // is handed, and d.payload returns the fixture object the json family serializes, so
  // rendering once put a _locals key in every json.* body until this copied.
  const small = { ...d.payload("small") };
  const medium = { ...d.payload("medium") };

  app.get("/template/small", (_, res) => res.render("items", small));

  app.get("/template/medium", (_, res) => res.render("items", medium));
}
