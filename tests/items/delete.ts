import { performanceTest } from "#kit";

const path = "/items/{draw.item}";

export default performanceTest({
  id: { family: "items", name: "delete" },
  path,
  about:
    "A row deleted and answered 204 with no body. Nothing is removed, so " +
    "every instance finds the row it names. Read against items.read, the " +
    "difference is that nothing is serialised at all.",

  request: (c) => c.delete(`/items/${c.draw.item()}`).status(204).emptyBody(),
});
