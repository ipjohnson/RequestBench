import { performanceTest } from "#kit";
import { items } from "#payloads";

const path = "/middleware/four";

export default performanceTest({
  id: { family: "middleware", name: "four" },
  path,
  base: "middleware.none",
  varies: "layers",
  about:
    "Four no-op layers in front of a handler that serialises the small " +
    "payload. Four layers in front of the handler, each calling the next and " +
    "doing nothing else. Read against middleware.none, the difference divided " +
    "by four is the framework's per-layer cost.",

  request: (c) => c.get(path).okWith(items.small),
});
