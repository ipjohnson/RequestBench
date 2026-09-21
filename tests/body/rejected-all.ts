import { performanceTest } from "#kit";
import { order } from "#payloads";

const path = "/body/validate/small";

export default performanceTest({
  id: { family: "body", name: "rejected_all" },
  path,
  about:
    "Three fields wrong in one body. What a rejection looks like is the " +
    "framework's own contract, so the status and the field paths are read " +
    "through its exceptions declaration and this test never sees an error " +
    "body.",

  request: (c) => c.post(path, order.invalid.value).rejected("customerId", "status", "lines"),
});
