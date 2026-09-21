import { performanceTest } from "#kit";
import { items } from "#payloads";

const path = "/cache/medium";

export default performanceTest({
  id: { family: "cache", name: "medium" },
  path,
  about:
    "The handler skipped and a stored answer written back. Read against " +
    "json.medium, the difference is the store answering instead of the " +
    "framework, which is why this row asserts the serial repeated rather than " +
    "advanced.",

  request: (c) => c.get(path).okWith(items.medium).replayed(),
});
