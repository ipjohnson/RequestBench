import { performanceTest } from "#kit";

const path = "/items/999999";

export default performanceTest({
  id: { family: "errors", name: "not_found" },
  path,
  base: "items.read",
  varies: "outcome",
  about:
    "A lookup the router matches and the handler refuses, because no row has " +
    "that id. Read against items.read, the difference is the refusal in place " +
    "of a row, and against errors.unmatched it is the handler deciding rather " +
    "than the router missing.",

  request: (c) => c.get(path).notFound(),
});
