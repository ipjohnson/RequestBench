import { performanceTest } from "#kit";
import { items } from "#payloads";

const path = "/parameters/{run.one}/segment/literal";

export default performanceTest({
  id: { family: "parameters", name: "one" },
  path,
  about:
    "One segment captured, bound as an integer and written back. The value is " +
    "drawn per run, so a framework that answered from a table would have had " +
    "to know it in advance, and the echo is checked against what was sent.",

  request: (c) => c.get(`/parameters/${c.run.one}/segment/literal`).okWith(items.small, { echo: ["one"] }),
});
