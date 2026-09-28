import { family } from "#kit";
import large from "./large.ts";
import medium from "./medium.ts";
import small from "./small.ts";

export default family({
  name: "static",
  about:
    "The framework's static-file feature, serving committed files from the " +
    "payload directory.",
  comparable:
    "Across every framework. The files are items.small.json, " +
    "items.medium.json and items.large.json, so read against the json row of " +
    "the same size the difference is the file served against the same rows " +
    "serialised.",

  tests: [large, medium, small],
});
