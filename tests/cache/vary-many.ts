import { performanceTest } from "#kit";
import { items } from "#payloads";

const path = "/cache/vary/many/{draw.key}";
/** Two values of each header, so a store that ignores one holds half the entries it was sent. */
const channels = ["web", "app"];
const regions = ["eu", "us"];
const tenants = ["alpha", "beta"];

export default performanceTest({
  id: { family: "cache", name: "vary_many" },
  path,
  base: "cache.vary_one",
  varies: "cache_key",
  heft: 1,
  about:
    "The same thing keyed on three headers instead of one. Read against " +
    "cache.vary_one, the difference is thirty-two distinct keys where there were " +
    "eight, which is what a store has to be sized against rather than what it " +
    "costs to read.",

  request: (c) =>
    c
      .get(`/cache/vary/many/${c.draw.key()}`)
      .header("x-rb-channel", c.draw.choice(channels))
      .header("x-rb-region", c.draw.choice(regions))
      .header("x-rb-tenant", c.draw.choice(tenants))
      .okWith(items.small)
      .replayed(),
});
