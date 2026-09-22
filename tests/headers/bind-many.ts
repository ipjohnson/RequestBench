import { performanceTest } from "#kit";
import { items } from "#payloads";
import { BROWSER_AND_PROXY } from "#models/fixture";

const path = "/headers/bind";

export default performanceTest({
  id: { family: "headers", name: "bind_many" },
  path,
  base: "headers.bind_few",
  varies: "header_count",
  about:
    "Three headers bound out of thirty instead of out of five. Read against " +
    "headers.bind_few, the difference is whether a framework's binder pays " +
    "for the headers it was not asked about.",

  request: (c) => {
    let call = c
      .get(path)
      .header("x-rb-tenant", c.run.tenant)
      .header("x-rb-request-id", c.run.requestId)
      .header("x-rb-account", String(c.run.account));

    for (const [name, value] of BROWSER_AND_PROXY) call = call.header(name, value);

    return call.okWith(items.small, { echo: ["tenant", "requestId", "account"] });
  },
});
