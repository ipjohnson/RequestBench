import { family } from "#kit";
import ndjson from "./ndjson.ts";

export default family({
  name: "stream",
  about:
    "A response written in parts as it is produced, rather than serialised " +
    "whole and sent with its length.",
  comparable:
    "Across every framework. The rows are items.medium's, so the difference " +
    "from json.medium is the streaming path and a write per row.",

  tests: [ndjson],
});
