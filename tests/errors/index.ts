import { family } from "#kit";
import malformed from "./malformed.ts";
import notFound from "./not-found.ts";
import unmatched from "./unmatched.ts";
import wrongMethod from "./wrong-method.ts";

export default family({
  name: "errors",
  about:
    "A router miss, a handler's miss, a method the route does not have, and " +
    "a parser failure.",
  comparable:
    "Across every framework, on the status and on whether the answer carries " +
    "a body at all. Not on the body's shape, which is the framework's own " +
    "contract.",

  tests: [malformed, notFound, unmatched, wrongMethod],
});
