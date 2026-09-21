import { family } from "#kit";
import create from "./create.ts";
import deleted from "./delete.ts";
import head from "./head.ts";
import read from "./read.ts";
import replace from "./replace.ts";
import update from "./update.ts";

export default family({
  name: "items",
  about:
    "Every method on one resource, over the rows of the large item payload: " +
    "a row read, its headers alone, and four writes that answer as if they " +
    "had written.",
  comparable:
    "Across every framework. Each row sends one row-sized body or none and " +
    "answers one row or nothing, so the methods differ in what the framework " +
    "does with the request rather than in how much it serialises. A measured " +
    "row may not leave the server changed, so the writes store nothing and no " +
    "framework's store is what is measured.",

  tests: [create, deleted, head, read, replace, update],
});
