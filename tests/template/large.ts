import { performanceTest } from "#kit";
import { pages } from "#payloads";

const path = "/template/large";

export default performanceTest({
  id: { family: "template", name: "large" },
  path,
  base: "json.large",
  varies: "renderer",
  heft: 5,
  about:
    "All 1,425 rows of items.large through the same template. Read against " +
    "template.medium, the difference is the engine's per-row cost at scale, " +
    "and against json.large it is rendering against serialising at one size.",

  request: (c) => c.get(path).okWith(pages.large).hasHeader("content-type", /html/),
});
