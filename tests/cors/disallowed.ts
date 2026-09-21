import { validationTest } from "#kit";
import { settings } from "#payloads";

const path = "/cors/small";
const cors = settings.value.cors;

export default validationTest({
  id: { family: "cors", name: "disallowed" },
  path,
  about:
    "A preflight from an origin the policy does not name gets no " +
    "access-control-allow-origin, which is what stops the browser. The status " +
    "is not checked, because frameworks differ on it.",

  request: (c) =>
    c
      .options(path)
      .header("origin", "https://elsewhere.example.net")
      .header("access-control-request-method", cors.method)
      .header("access-control-request-headers", cors.header)
      .noHeader("access-control-allow-origin"),
});
