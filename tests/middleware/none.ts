import { performanceTest } from "#kit";
import { items } from "#payloads";

const path = "/middleware/none";

export default performanceTest({
  id: { family: "middleware", name: "none" },
  path,
  base: "json.small",
  varies: "route",
  about:
    "No layers in front of a handler that serialises the small payload. A " +
    "different route carrying the same handler, which should cost nothing. It " +
    "is the zero point the other two are read against, and a framework where " +
    "this differs from json.small is paying for the route rather than the " +
    "layers.",

  request: (c) => c.get(path).okWith(items.small),
});
