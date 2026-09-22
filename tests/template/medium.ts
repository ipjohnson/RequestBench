import { performanceTest } from "#kit";
import { pages } from "#payloads";

const path = "/template/medium";

export default performanceTest({
  id: { family: "template", name: "medium" },
  path,
  base: "json.medium",
  varies: "renderer",
  about:
    "Eighty-nine rows through the same template. Read against template.small, " +
    "the difference is the engine's per-row cost, and against json.medium it " +
    "is rendering against serialising at one size.",

  request: (c) => c.get(path).okWith(pages.medium).hasHeader("content-type", /html/),
});
