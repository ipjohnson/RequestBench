import { family } from "#kit";
import one from "./one.ts";
import parametersStatic from "./static.ts";
import three from "./three.ts";
import two from "./two.ts";

export default family({
  name: "parameters",
  about:
    "Router captures, with segment depth held constant, each bound as an " +
    "integer and echoed.",
  comparable:
    "Across every framework. The static row holds the depth, so the capture " +
    "rows minus it is the router capturing rather than the router matching.",

  tests: [one, parametersStatic, three, two],
});
