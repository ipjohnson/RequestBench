import { performanceTest } from "#kit";
import { items, settings } from "#payloads";

const path = "/cache/vary/one";
const vary = settings.value.cache.vary.one;

export default performanceTest({
  id: { family: "cache", name: "vary_one" },
  path,
  about:
    "The stored answer keyed by a request header as well as by the path. One " +
    "header with two values, picked per instance, so a store that ignores the " +
    "vary header holds one entry where the plan sent two keys.",

  request: (c) =>
    c
      .get(path)
      .header("x-rb-tenant", c.draw.choice(vary["x-rb-tenant"]))
      .okWith(items.small)
      .replayed(),
});
