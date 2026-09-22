import { performanceTest } from "#kit";
import { items, patched } from "#payloads";

const path = "/items/{draw.item}";

export default performanceTest({
  id: { family: "items", name: "update" },
  path,
  base: "items.replace",
  varies: "method",
  about:
    "Two fields patched onto a row and answered with the row as it would be. " +
    "The handler has to read the row, merge the body into it and serialise " +
    "the result. Read against items.replace, the difference is the merge.",

  request: (c) => {
    const id = c.draw.item();
    return c.patch(`/items/${id}`, items.patch.value).okWith(patched(id));
  },
});
