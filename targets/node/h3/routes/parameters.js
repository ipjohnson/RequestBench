// parameters: router captures with segment depth held constant.
import * as d from "../../_shared/domain.js";

// rb:wiring parameters.*
const small = () => d.payload("small");

export default function parameters(app) {
  app.get("/parameters/static/segment/literal", small);

  app.get("/parameters/:one", small);

  app.get("/parameters/:one/with-second/:two", small);
}
