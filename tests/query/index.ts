import { family } from "#kit";
import many from "./many.ts";
import one from "./one.ts";

export default family({
  name: "query",
  about:
    "Query string parsing, percent-decoding and coercion, with the values " +
    "echoed and put to no other use.",
  comparable:
    "Across every framework. Eight parameters on the many row, because eight " +
    "is what a real search endpoint carries: a page and a size, a sort, a " +
    "text term and four filters.",

  tests: [many, one],
});
