import { performanceTest } from "#kit";
import { items, replaced } from "#payloads";

const path = "/items/{draw.item}";

export default performanceTest({
  id: { family: "items", name: "replace" },
  path,
  about:
    "A whole item put at an id and answered with the item under that id. Read " +
    "against items.create, the difference is the id coming from the path " +
    "rather than from the server.",

  request: (c) => {
    const id = c.draw.item();
    return c.put(`/items/${id}`, items.new.value).okWith(replaced(id));
  },
});
