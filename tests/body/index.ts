import { family } from "#kit";
import bindMedium from "./bind-medium.ts";
import bindSmall from "./bind-small.ts";
import rejectedAll from "./rejected-all.ts";
import rejectedFirst from "./rejected-first.ts";
import validateMedium from "./validate-medium.ts";
import validateSmall from "./validate-small.ts";

export default family({
  name: "body",
  about:
    "The parser and the validator, with size crossed against validation.",
  comparable:
    "Across every framework. Bind parses without validating, so validate " +
    "minus bind is the validator alone rather than the validator plus the " +
    "parse.",

  tests: [bindMedium, bindSmall, rejectedAll, rejectedFirst, validateMedium, validateSmall],
});
