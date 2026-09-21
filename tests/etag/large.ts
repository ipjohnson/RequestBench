import { performanceTest } from "#kit";
import { items } from "#payloads";

const path = "/etag/large";

export default performanceTest({
  id: { family: "etag", name: "large" },
  path,
  about:
    "The framework hashing the body it is about to send and writing the " +
    "validator it computed onto the response. Read against json.large, the " +
    "difference is the hash and the header. The tag is the framework's own, " +
    "so no two of them agree on it.",

  request: (c) => c.get(path).okWith(items.large).hasHeader("etag").fresh(),
});
