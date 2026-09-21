import { validationTest } from "#kit";
import { settings } from "#payloads";

const path = "/json/small";
const cors = settings.value.cors;

export default validationTest({
  id: { family: "cors", name: "scoped" },
  path,
  about:
    "The allowed origin asking a route outside /cors gets no " +
    "access-control-allow-origin, because the policy is attached to /cors and " +
    "nowhere else. A framework whose CORS feature can only cover the whole " +
    "application cannot pass this, and says why in the skips of its rb.json.",

  request: (c) => c.get(path).header("origin", cors.origin).ok().noHeader("access-control-allow-origin"),
});
