import { family } from "#kit";
import gzipLarge from "./gzip-large.ts";
import gzipSmall from "./gzip-small.ts";
import identityLarge from "./identity-large.ts";
import identitySmall from "./identity-small.ts";

export default family({
  name: "compressed",
  about:
    "Outbound gzip: the wiring declining, the wiring working, and the " +
    "small-body threshold.",
  comparable:
    "Across every framework. The identity rows carry the middleware installed " +
    "and refusing, so subtracting them from the gzip rows leaves the " +
    "compression itself.",

  tests: [gzipLarge, gzipSmall, identityLarge, identitySmall],
});
