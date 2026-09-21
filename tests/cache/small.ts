import { performanceTest } from "#kit";
import { items } from "#payloads";

const path = "/cache/small";

export default performanceTest({
  id: { family: "cache", name: "small" },
  path,
  about:
    "The handler skipped and a stored answer written back. Read against " +
    "json.small, the difference is the store answering instead of the " +
    "framework, which is why this row asserts the serial repeated rather than " +
    "advanced.",

  request: (c) => c.get(path).okWith(items.small).replayed(),
});
