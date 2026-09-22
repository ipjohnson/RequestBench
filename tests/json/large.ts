import { performanceTest } from "#kit";
import { items } from "#payloads";

const path = "/json/large";

export default performanceTest({
  id: { family: "json", name: "large" },
  path,
  base: "json.small",
  varies: "size",
  about:
    "Fourteen hundred rows out, serialised from a body the framework already " +
    "holds. The size at which the writer stops being free. Read against " +
    "json.small, the pair is what separates a framework with a fast codec " +
    "from one with a fast request path.",

  request: (c) => c.get(path).okWith(items.large),
});
