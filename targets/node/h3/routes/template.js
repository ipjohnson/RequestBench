// template: server-side rendering of the same model the json family serializes.
//
// The engine is handlebars, shared with every other Node target and named on /__meta.
// h3 v2's `html` export is a template-literal tag rather than a response helper, so the
// content type is set on the response directly.
import { renderItems } from "../../_shared/template.js";
import * as d from "../../_shared/domain.js";

const render = (size) => (e) => {
  e.res.headers.set("content-type", "text/html; charset=utf-8");
  return renderItems(d.payload(size));
};

export default function template(app) {
  app.get("/template/small", render("small"));

  app.get("/template/medium", render("medium"));
}
