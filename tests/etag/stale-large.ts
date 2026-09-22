import { performanceTest } from "#kit";
import { items, settings } from "#payloads";

const path = "/etag/large";

export default performanceTest({
  id: { family: "etag", name: "stale_large" },
  path,
  base: "etag.large",
  varies: "stale_validator",
  about:
    "A conditional request whose validator does not match, answered in full. " +
    "Read against etag.match_large, the difference is the write the 304 " +
    "saved, and read against etag.large it is the comparison that failed.",

  request: (c) => c.get(path).header("if-none-match", settings.value.staleEtag).okWith(items.large).fresh(),
});
