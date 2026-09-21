import { performanceTest } from "#kit";
import { bind, order } from "#payloads";

const path = "/body/validate/medium";

export default performanceTest({
  id: { family: "body", name: "validate_medium" },
  path,
  about:
    "The same body checked against a schema before the handler sees it, and " +
    "answered exactly as the bind row answers it. Read against " +
    "body.bind_medium, the difference is the validator alone rather than the " +
    "validator plus the parse.",

  request: (c) => c.post(path, order.medium.value).okWith(bind.medium),
});
