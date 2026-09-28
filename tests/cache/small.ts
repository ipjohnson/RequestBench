import { performanceTest } from "#kit";
import { items } from "#payloads";

const path = "/cache/small/{draw.key}";

export default performanceTest({
  id: { family: "cache", name: "small" },
  path,
  base: "json.small",
  varies: "response_cache",
  heft: 1,
  about:
    "The handler skipped and a stored answer written back, under one of four " +
    "keys the path names. Read against json.small, the difference is the store " +
    "answering instead of the framework, which is why this row asserts the " +
    "serial repeated rather than changed.",

  request: (c) => c.get(`/cache/small/${c.draw.key()}`).okWith(items.small).replayed(),
});
