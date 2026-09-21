import { performanceTest } from "#kit";
import { row } from "#payloads";

const path = "/items/{draw.item}";

export default performanceTest({
  id: { family: "items", name: "read" },
  path,
  about:
    "One row of the large payload, looked up by the id in the path. The id is " +
    "drawn per request, so each instance reads a different row. Read against " +
    "parameters.one, the difference is a lookup and one row serialised in " +
    "place of an echo beside the small payload.",

  request: (c) => {
    const id = c.draw.item();
    return c.get(`/items/${id}`).okWith(row(id));
  },
});
