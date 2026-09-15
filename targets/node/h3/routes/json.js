// json: the serializer and response buffering across three size regimes.
//
// Three static routes, not /json/:size. The size set is fixed, so a capture would make the
// router pay parameter cost on the family every other target serves from a static route.
import * as d from "../../_shared/domain.js";

export default function json(app) {
  app.get("/json/small", () => d.payload("small"));

  app.get("/json/medium", () => d.payload("medium"));

  app.get("/json/large", () => d.payload("large"));
}
