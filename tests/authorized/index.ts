import { family } from "#kit";
import allowed from "./allowed.ts";
import denied from "./denied.ts";

export default family({
  name: "authorized",
  about:
    "The framework's own authorization mechanism, with the crypto left out.",
  comparable:
    "Across every framework. The token differs from the accepted one by its " +
    "last character, so the denial arm walks the same string and measures the " +
    "plumbing rather than a length check.",

  tests: [allowed, denied],
});
