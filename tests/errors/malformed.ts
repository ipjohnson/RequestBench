import { performanceTest } from "#kit";

const path = "/body/validate/small";

/** Truncated mid-array, so the parser fails before any field is ever looked at. */
const MALFORMED = '{"customerId": 1, "lines": [';

export default performanceTest({
  id: { family: "errors", name: "malformed" },
  path,
  base: "body.rejected_all",
  varies: "parse_failure",
  about:
    "A body that is not JSON at all. Read against body.rejected_all, the " +
    "difference is the parser failing rather than the validator refusing, " +
    "which is often not even the same status inside one framework.",

  request: (c) => c.post(path).raw(MALFORMED).unparseable(),
});
