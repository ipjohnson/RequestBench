import { family } from "#kit";
import medium from "./medium.ts";
import small from "./small.ts";

export default family({
  name: "template",
  about:
    "Server-side rendering of the same model the json family serialises.",
  comparable:
    "Across template engines rather than across frameworks. Rendering is " +
    "partly the engine's work, so a ranking that carried these rows would be " +
    "measuring one engine against another.",

  tests: [medium, small],
});
