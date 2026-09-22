import { performanceTest } from "#kit";
import { settings } from "#payloads";

const path = "/cors/small";
const cors = settings.value.cors;

/** The header among any others the framework lists, in any case. */
const LISTS = new RegExp(`(^|,)\\s*${cors.header}\\s*(,|$)`, "i");

export default performanceTest({
  id: { family: "cors", name: "preflight" },
  path,
  base: "baseline.plaintext",
  varies: "preflight",
  about:
    "The question a browser asks before a cross-origin request with a custom " +
    "header, answered by the CORS feature before any handler runs. The " +
    "handler on this route writes x-rb-serial, so its absence shows the " +
    "feature answered alone. 200 and 204 are both accepted, because the Fetch " +
    "standard takes any 2xx and frameworks split. Read against " +
    "baseline.plaintext, the difference is the policy being matched.",

  request: (c) =>
    c
      .options(path)
      .header("origin", cors.origin)
      .header("access-control-request-method", cors.method)
      .header("access-control-request-headers", cors.header)
      .status(200, 204)
      .hasHeader("access-control-allow-origin", cors.origin)
      .hasHeader("access-control-allow-headers", LISTS)
      .hasHeader("access-control-max-age", String(cors.maxAgeSeconds))
      .noHeader("x-rb-serial"),
});
