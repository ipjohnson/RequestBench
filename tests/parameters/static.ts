import { performanceTest } from "#kit";
import { items } from "#payloads";

const path = "/parameters/static/segment/literal";

export default performanceTest({
  id: { family: "parameters", name: "static" },
  path,
  base: "json.small",
  varies: "depth",
  about:
    "Four static segments and no captures. This holds the route depth " +
    "constant for the two rows that capture, so subtracting it leaves the " +
    "router capturing rather than the router matching a longer path.",

  request: (c) => c.get(path).okWith(items.small),
});
