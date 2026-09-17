// parameters: router captures with segment depth held constant.
import * as d from "../../_shared/domain.js";

// rb:wiring parameters.*
const small = (ctx) => { ctx.body = d.payload("small"); };

export default function parameters(router) {
  router.get("/parameters/static/segment/literal", small);

  router.get("/parameters/:one", small);

  router.get("/parameters/:one/with-second/:two", small);
}
