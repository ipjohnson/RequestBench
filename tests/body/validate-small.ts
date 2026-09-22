import { performanceTest } from "#kit";
import { bind, order } from "#payloads";

const path = "/body/validate/small";

export default performanceTest({
  id: { family: "body", name: "validate_small" },
  path,
  base: "body.bind_small",
  varies: "validation",
  about:
    "The same body checked against a schema before the handler sees it, and " +
    "answered exactly as the bind row answers it. Read against " +
    "body.bind_small, the difference is the validator alone rather than the " +
    "validator plus the parse.",

  request: (c) => c.post(path, order.small.value).okWith(bind.small),
});
