import { family } from "#kit";
import large from "./large.ts";
import matchLarge from "./match-large.ts";
import small from "./small.ts";
import staleLarge from "./stale-large.ts";

export default family({
  name: "etag",
  about:
    "The framework's own conditional-request machinery: the validator it " +
    "computes over the body, and the 304 it answers.",
  comparable:
    "Across every framework at one body size. Not across sizes: the small row " +
    "hashes a row and the large row hashes fourteen hundred, and the ratio " +
    "between them is a hash rate.",

  tests: [large, matchLarge, small, staleLarge],
});
