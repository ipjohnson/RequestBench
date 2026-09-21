import { family } from "#kit";
import multipart from "./multipart.ts";
import urlencoded from "./urlencoded.ts";

export default family({
  name: "forms",
  about:
    "Request bodies that are not JSON: a urlencoded form and a multipart " +
    "upload, each bound through the framework's own form support.",
  comparable:
    "Across every framework. The urlencoded row answers what query.many " +
    "answers, so the pair differs only in where the eight fields came from.",

  tests: [multipart, urlencoded],
});
