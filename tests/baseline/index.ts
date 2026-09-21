import { family } from "#kit";
import plaintext from "./plaintext.ts";

export default family({
  name: "baseline",
  about:
    "The dispatch floor, with nothing serialised.",
  comparable:
    "Across every framework. It is the row the rest are read against rather " +
    "than a measurement of anything on its own: a framework that is slow here " +
    "is slow everywhere.",

  tests: [plaintext],
});
