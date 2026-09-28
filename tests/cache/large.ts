import { performanceTest } from "#kit";
import { items } from "#payloads";

const path = "/cache/large/{draw.key}";

export default performanceTest({
  id: { family: "cache", name: "large" },
  path,
  base: "json.large",
  varies: "response_cache",
  heft: 3,
  about:
    "The handler skipped and a stored answer written back, under one of four " +
    "keys the path names. Read against json.large, the difference is the store " +
    "answering instead of the framework, which is why this row asserts the " +
    "serial repeated rather than changed.",

  request: (c) => c.get(`/cache/large/${c.draw.key()}`).okWith(items.large).replayed(),
});
