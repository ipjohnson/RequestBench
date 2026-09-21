import { performanceTest } from "#kit";
import { pages } from "#payloads";

const path = "/template/small";

export default performanceTest({
  id: { family: "template", name: "small" },
  path,
  about:
    "One row rendered through the framework's own view layer instead of " +
    "serialised. Read against json.small, the difference is the engine, which " +
    "is why this family is comparable across engines and not across " +
    "frameworks.",

  request: (c) => c.get(path).okWith(pages.small).hasHeader("content-type", /html/),
});
