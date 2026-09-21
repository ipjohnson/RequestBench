import { validationTest } from "#kit";
import { settings } from "#payloads";

const path = "/cors/small";
const cors = settings.value.cors;

export default validationTest({
  id: { family: "cors", name: "vary" },
  path,
  about:
    "The real response carries Vary: Origin. A policy that names its origin " +
    "answers differently per origin, so a cache in front of the framework has " +
    "to key on it.",

  request: (c) =>
    c
      .get(path)
      .header("origin", cors.origin)
      .header(cors.header, c.run.tenant)
      .ok()
      .hasHeader("vary", /(^|,)\s*origin\s*(,|$)/i),
});
