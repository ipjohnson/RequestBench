import { performanceTest } from "#kit";
import { items } from "#payloads";

const path = "/etag/small";

export default performanceTest({
  id: { family: "etag", name: "small" },
  path,
  base: "json.small",
  varies: "validators",
  about:
    "The framework hashing the body it is about to send and writing the " +
    "validator it computed onto the response. Read against json.small, the " +
    "difference is the hash and the header. The tag is the framework's own, " +
    "so no two of them agree on it.",

  request: (c) => c.get(path).okWith(items.small).hasHeader("etag").fresh(),
});
