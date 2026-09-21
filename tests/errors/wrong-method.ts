import { performanceTest } from "#kit";

const path = "/items/{draw.item}";

export default performanceTest({
  id: { family: "errors", name: "wrong_method" },
  path,
  about:
    "A path with routes, asked with a method none of them has. A router that " +
    "matches the path first answers 405, and one that matches the method and " +
    "the path together answers 404, so the status is read from the " +
    "framework's declaration. Read against errors.unmatched, the difference " +
    "is how far the router got before it gave up.",

  request: (c) => c.post(`/items/${c.draw.item()}`).wrongMethod(),
});
