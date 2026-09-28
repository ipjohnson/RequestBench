import { performanceTest } from "#kit";
import { items } from "#payloads";

const path = "/cache/medium/{draw.key}";

export default performanceTest({
  id: { family: "cache", name: "medium" },
  path,
  base: "json.medium",
  varies: "response_cache",
  heft: 1,
  about:
    "The handler skipped and a stored answer written back, under one of four " +
    "keys the path names. Read against json.medium, the difference is the store " +
    "answering instead of the framework, which is why this row asserts the " +
    "serial repeated rather than changed.",

  request: (c) => c.get(`/cache/medium/${c.draw.key()}`).okWith(items.medium).replayed(),
});
