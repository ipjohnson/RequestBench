import { performanceTest } from "#kit";
import { items, settings } from "#payloads";

const path = "/cors/small";
const cors = settings.value.cors;

export default performanceTest({
  id: { family: "cors", name: "request" },
  path,
  about:
    "The cross-origin request itself, with the origin and the custom header " +
    "the preflight asked about. The feature adds its header and lets the " +
    "request through to the handler. Read against json.small, the difference " +
    "is the policy checked on a request that passes it.",

  request: (c) =>
    c
      .get(path)
      .header("origin", cors.origin)
      .header(cors.header, c.run.tenant)
      .okWith(items.small)
      .hasHeader("access-control-allow-origin", cors.origin)
      .fresh(),
});
