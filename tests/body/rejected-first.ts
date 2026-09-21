import { performanceTest } from "#kit";
import { order } from "#payloads";

const path = "/body/validate/first-error";

export default performanceTest({
  id: { family: "body", name: "rejected_first" },
  path,
  about:
    "The same body against a route that stops at the first bad field. Read " +
    "against body.rejected_all, the difference is the two error contracts: " +
    "one walks the whole object and one gives up, and the second is doing " +
    "less work.",

  request: (c) => c.post(path, order.invalid.value).rejected("customerId"),
});
