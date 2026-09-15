// headers: eager against lazy construction of the request header map.
//
// The handler reads no header at all, so headers.many minus headers.few is the cost of
// materialising 27 nobody asked for.
import * as d from "../../_shared/domain.js";

export default function headers(app) {
  app.get("/headers", () => d.payload("small"));
}
