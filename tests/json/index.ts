import { family } from "#kit";
import large from "./large.ts";
import medium from "./medium.ts";
import small from "./small.ts";

export default family({
  name: "json",
  about:
    "Serialising a body the framework already holds, across three size " +
    "regimes.",
  comparable:
    "Across every framework at one size, and across the three sizes as a set. " +
    "The small row against the large one is what separates a framework with a " +
    "fast codec from one with a fast request path.",

  tests: [large, medium, small],
});
