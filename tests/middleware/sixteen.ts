import { performanceTest } from "#kit";
import { items } from "#payloads";

const path = "/middleware/sixteen";

export default performanceTest({
  id: { family: "middleware", name: "sixteen" },
  path,
  about:
    "Sixteen no-op layers in front of a handler that serialises the small " +
    "payload. Sixteen layers, which is where a per-layer cost that looked " +
    "like noise at four becomes readable. Read against middleware.none, and " +
    "against middleware.four to see whether the cost is linear.",

  request: (c) => c.get(path).okWith(items.small),
});
