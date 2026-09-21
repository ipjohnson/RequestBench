import { family } from "#kit";
import bindFew from "./bind-few.ts";
import bindMany from "./bind-many.ts";
import few from "./few.ts";
import many from "./many.ts";

export default family({
  name: "headers",
  about:
    "The request header map at five headers and at thirty, left unread and " +
    "with three of them bound and echoed.",
  comparable:
    "Across every framework. The unread rows hold the count, so the bound " +
    "rows minus them is the binding rather than the materialising.",

  tests: [bindFew, bindMany, few, many],
});
