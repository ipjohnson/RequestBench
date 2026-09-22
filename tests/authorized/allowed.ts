import { performanceTest } from "#kit";
import { items, settings } from "#payloads";

const path = "/authorized/small";

export default performanceTest({
  id: { family: "authorized", name: "allowed" },
  path,
  base: "json.small",
  varies: "authorization",
  about:
    "A bearer token the framework's own authorization mechanism has to check " +
    "before the handler runs. Read against json.small, the difference is the " +
    "check and the plumbing that carries it, not the crypto, which this " +
    "family leaves out.",

  request: (c) => c.get(path).header("authorization", `Bearer ${settings.value.token}`).okWith(items.small),
});
