import { performanceTest } from "#kit";
import { bind, order } from "#payloads";

const path = "/body/bind/large";

export default performanceTest({
  id: { family: "body", name: "bind_large" },
  path,
  base: "body.bind_medium",
  varies: "size",
  heft: 4,
  about:
    "A body parsed and bound without being validated, at about 40 KB. The " +
    "answer carries a count of the leaves it found, which is what says the " +
    "request was parsed rather than piped to the response. Read against " +
    "body.bind_medium, the difference is the parser and the binder at scale.",

  request: (c) => c.post(path, order.large.value).okWith(bind.large),
});
