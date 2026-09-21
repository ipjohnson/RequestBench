import { performanceTest } from "#kit";
import { items } from "#payloads";

const path = "/json/small";

export default performanceTest({
  id: { family: "json", name: "small" },
  path,
  about:
    "One row out, serialised from a body the framework already holds. The " +
    "plainest question in the corpus once something has to be serialised. " +
    "Read against baseline.plaintext, the difference is the codec.",

  request: (c) => c.get(path).okWith(items.small),
});
