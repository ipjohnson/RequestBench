// json: the serializer and response buffering across three size regimes.
//
// Three static routes, not /json/:size. The size set is fixed, so a capture would make the
// router pay parameter cost on the family every other target serves from a static route.
import * as d from "../../_shared/domain.js";

export default function json(router) {
  router.get("/json/small", (ctx) => { ctx.body = d.payload("small"); });

  router.get("/json/medium", (ctx) => { ctx.body = d.payload("medium"); });

  router.get("/json/large", (ctx) => { ctx.body = d.payload("large"); });
}
