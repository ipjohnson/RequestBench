import { performanceTest } from "#kit";
import { stream } from "#payloads";

const path = "/stream/items";

export default performanceTest({
  id: { family: "stream", name: "ndjson" },
  path,
  base: "json.medium",
  varies: "streaming",
  about:
    "items.medium's 89 rows written one per line as application/x-ndjson. " +
    "There is no Content-Length, which is what shows the body left in parts " +
    "rather than buffered. Read against json.medium, the difference is the " +
    "framework's streaming path and a write per row.",

  request: (c) => c.get(path).okWith(stream).hasHeader("content-type", /^application\/x-ndjson/).noHeader("content-length"),
});
