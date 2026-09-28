import { performanceTest } from "#kit";
import { items, settings } from "#payloads";

const path = "/cache/vary/one/{draw.key}";
const vary = settings.value.cache.vary.one;

export default performanceTest({
  id: { family: "cache", name: "vary_one" },
  path,
  base: "cache.small",
  varies: "cache_key",
  heft: 1,
  about:
    "The stored answer keyed by a request header as well as by the path. One " +
    "header with two values, picked per instance, so a store that ignores the " +
    "vary header holds four entries where the plan sent eight keys.",

  request: (c) =>
    c
      .get(`/cache/vary/one/${c.draw.key()}`)
      .header("x-rb-tenant", c.draw.choice(vary["x-rb-tenant"]))
      .okWith(items.small)
      .replayed(),
});
