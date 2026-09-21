import { performanceTest } from "#kit";
import { items, settings } from "#payloads";

const path = "/cache/vary/many";
const vary = settings.value.cache.vary.many;

export default performanceTest({
  id: { family: "cache", name: "vary_many" },
  path,
  about:
    "The same thing keyed on three headers instead of one. Read against " +
    "cache.vary_one, the difference is eight distinct keys where there were " +
    "two, which is what a store has to be sized against rather than what it " +
    "costs to read.",

  request: (c) =>
    c
      .get(path)
      .header("x-rb-channel", c.draw.choice(vary["x-rb-channel"]))
      .header("x-rb-region", c.draw.choice(vary["x-rb-region"]))
      .header("x-rb-tenant", c.draw.choice(vary["x-rb-tenant"]))
      .okWith(items.small)
      .replayed(),
});
