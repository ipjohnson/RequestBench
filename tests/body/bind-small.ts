import { performanceTest } from "#kit";
import { bind, order } from "#payloads";

const path = "/body/bind/small";

export default performanceTest({
  id: { family: "body", name: "bind_small" },
  path,
  about:
    "A body parsed and bound without being validated. The answer carries a " +
    "count of the leaves it found, which is what says the request was parsed " +
    "rather than piped to the response. This is what the validate row of the " +
    "same size is subtracted from.",

  request: (c) => c.post(path, order.small.value).okWith(bind.small),
});
