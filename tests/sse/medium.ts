import { performanceTest } from "#kit";
import { sse } from "#payloads";

const path = "/sse/medium";

export default performanceTest({
  id: { family: "sse", name: "medium" },
  path,
  base: "stream.ndjson",
  varies: "event_stream",
  about:
    "items.medium's 89 rows, each the data of one server-sent event. The request " +
    "carries the Accept header an EventSource sends. Every event is of type " +
    "message with no id, and there is no Content-Length. Read against " +
    "stream.ndjson, the difference is the framework's event framing against a " +
    "line per row.",

  request: (c) =>
    c
      .get(path)
      .header("accept", "text/event-stream")
      .okWith(sse)
      .hasHeader("content-type", /^text\/event-stream/)
      .noHeader("content-length"),
});
