import { performanceTest } from "#kit";
import { items } from "#payloads";

const path = "/json/medium";

export default performanceTest({
  id: { family: "json", name: "medium" },
  path,
  about:
    "Eighty-nine rows out, serialised from a body the framework already " +
    "holds. The middle size, where the codec is doing real work and the " +
    "response still fits a single write. Read against json.small rather than " +
    "on its own.",

  request: (c) => c.get(path).okWith(items.medium),
});
