import { performanceTest } from "#kit";
import { settings } from "#payloads";

const path = "/authorized/small";

export default performanceTest({
  id: { family: "authorized", name: "denied" },
  path,
  base: "authorized.allowed",
  varies: "outcome",
  about:
    "The same endpoint refusing. The token differs from the accepted one by " +
    "its last character, so the comparison walks the whole string and this " +
    "row measures the refusal path rather than a length check.",

  request: (c) => c.get(path).header("authorization", `Bearer ${settings.value.wrongToken}`).status(403),
});
