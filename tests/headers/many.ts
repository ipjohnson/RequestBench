import { performanceTest } from "#kit";
import { items } from "#payloads";
import { BROWSER_AND_PROXY } from "#models/fixture";

const path = "/headers";

export default performanceTest({
  id: { family: "headers", name: "many" },
  path,
  about:
    "Thirty request headers, still read by nothing. Read against headers.few, " +
    "the difference is the cost of materialising twenty-five more that nobody " +
    "asked for, which is about a kilobyte and close to what a real request " +
    "carries.",

  request: (c) => {
    let call = c
      .get(path)
      .header("x-rb-tenant", c.run.tenant)
      .header("x-rb-request-id", c.run.requestId)
      .header("x-rb-account", String(c.run.account));

    for (const [name, value] of BROWSER_AND_PROXY) call = call.header(name, value);

    return call.okWith(items.small);
  },
});
