import { performanceTest } from "#kit";
import { items } from "#payloads";

const path = "/etag/large";

/** A validator no framework computes. */
const stale = '"0000000000000000"';

export default performanceTest({
  id: { family: "etag", name: "stale_large" },
  path,
  base: "etag.large",
  varies: "stale_validator",
  heft: 4,
  about:
    "A conditional request whose validator does not match, answered in full. " +
    "Read against etag.match_large, the difference is the write the 304 " +
    "saved, and read against etag.large it is the comparison that failed.",

  request: (c) => c.get(path).header("if-none-match", stale).okWith(items.large).fresh(),
});
