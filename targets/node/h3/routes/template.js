// template: server-side rendering of the same model the json family serializes.
//
// h3 ships no view layer, so the handler renders and this target holds its own template.
// h3 v2's `html` export is a template-literal tag rather than a response helper, so the
// content type is set on the response directly. EJS is the most used template engine on
// npm by a wide margin, which is where a framework with no recommendation of its own
// leaves the choice.
import ejs from "ejs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import * as d from "../../_shared/domain.js";

const VIEWS = join(dirname(dirname(fileURLToPath(import.meta.url))), "views");

// Compiled once, rendered per request. A precomputed string would measure nothing.
const items = ejs.compile(readFileSync(join(VIEWS, "items.ejs"), "utf8"));

const render = (size) => {
  const body = d.payload(size);
  return (e) => {
    e.res.headers.set("content-type", "text/html; charset=utf-8");
    return items(body);
  };
};

export default function template(app) {
  app.get("/template/small", render("small"));

  app.get("/template/medium", render("medium"));
}
