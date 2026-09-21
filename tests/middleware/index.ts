import { family } from "#kit";
import four from "./four.ts";
import none from "./none.ts";
import sixteen from "./sixteen.ts";

export default family({
  name: "middleware",
  about:
    "Per-layer dispatch cost at zero, four and sixteen no-op layers.",
  comparable:
    "Across every framework. Every layer calls the next and does nothing " +
    "else, so the slope between the three is the framework's per-layer cost " +
    "and nothing else.",

  tests: [four, none, sixteen],
});
