import { performanceTest } from "#kit";
import { TOKEN } from "#models/configuration";
import { items } from "#payloads";

const path = "/authorized/small";

export default performanceTest({
  id: { family: "authorized", name: "allowed" },
  path,
  base: "json.small",
  varies: "authorization",
  heft: 1,
  about:
    "A bearer token the framework's own authorization mechanism has to check " +
    "before the handler runs. Read against json.small, the difference is the " +
    "check and the plumbing that carries it, not the crypto, which this " +
    "family leaves out.",

  request: (c) => c.get(path).header("authorization", `Bearer ${TOKEN}`).okWith(items.small),
});
