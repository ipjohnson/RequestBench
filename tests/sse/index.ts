import { family } from "#kit";
import medium from "./medium.ts";

export default family({
  name: "sse",
  about:
    "Server-sent events: a text/event-stream response written event by event " +
    "through the framework's own support for it.",
  comparable:
    "Across every framework. A framework with no support of its own writes the " +
    "events by hand, and says so in its README. The events carry stream.ndjson's " +
    "rows, so the difference from it is the event framing.",

  tests: [medium],
});
