import { family } from "#kit";
import file from "./file.ts";

export default family({
  name: "static",
  about:
    "The framework's static-file feature, serving a committed file from the " +
    "payload directory.",
  comparable:
    "Across every framework. The file is items.large.json, so read against " +
    "json.large the difference is a file sent as it is against the same rows " +
    "serialised.",

  tests: [file],
});
