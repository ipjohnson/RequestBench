import { performanceTest } from "#kit";

const path = "/errors/unmatched";

export default performanceTest({
  id: { family: "errors", name: "unmatched" },
  path,
  about:
    "A path no route matches, which is the router's own miss rather than a " +
    "handler's decision. A framework that walks its whole route table before " +
    "giving up pays for it here and nowhere else.",

  request: (c) => c.get(path).notFound(),
});
