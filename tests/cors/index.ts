import { family } from "#kit";
import disallowed from "./disallowed.ts";
import preflight from "./preflight.ts";
import request from "./request.ts";
import scoped from "./scoped.ts";
import vary from "./vary.ts";

export default family({
  name: "cors",
  about:
    "The framework's own CORS feature, attached to /cors with the one policy " +
    "every framework configures from settings.json: a preflight the feature " +
    "answers alone, and the real request it lets through.",
  comparable:
    "Across every framework. The policy names its origin, because with * the " +
    "feature compares nothing, and an API that sends credentials cannot use " +
    "*. A framework whose feature can only cover the whole application runs " +
    "it on every request, and says so in its README.",

  tests: [disallowed, preflight, request, scoped, vary],
});
