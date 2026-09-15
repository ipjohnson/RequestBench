// template: server-side rendering of the same model the json family serializes.
//
// The engine is handlebars, shared with every other Node target and named on /__meta.
import { renderItems } from "../../_shared/template.js";
import * as d from "../../_shared/domain.js";

export default function template(router) {
  router.get("/template/small", (ctx) => {
    ctx.type = "html";
    ctx.body = renderItems(d.payload("small"));
  });

  router.get("/template/medium", (ctx) => {
    ctx.type = "html";
    ctx.body = renderItems(d.payload("medium"));
  });
}
