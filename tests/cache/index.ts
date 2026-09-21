import { family } from "#kit";
import large from "./large.ts";
import medium from "./medium.ts";
import small from "./small.ts";
import varyMany from "./vary-many.ts";
import varyOne from "./vary-one.ts";

export default family({
  name: "cache",
  about:
    "The framework's response cache: the handler skipped and a stored answer " +
    "replayed, keyed by path and by request header.",
  comparable:
    "Across stores rather than across frameworks. Several frameworks ship no " +
    "response cache and run a package chosen for them, so a ranking that " +
    "carried these rows would be ranking the package.",

  tests: [large, medium, small, varyMany, varyOne],
});
