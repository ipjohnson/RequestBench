import { performanceTest } from "#kit";
import { items } from "#payloads";

const path = "/headers/bind";

export default performanceTest({
  id: { family: "headers", name: "bind_few" },
  path,
  about:
    "The same five headers with three of them bound through the framework and " +
    "written back, one as an integer. Read against headers.few, the " +
    "difference is the binding rather than the materialising.",

  request: (c) =>
    c
      .get(path)
      .header("x-rb-tenant", c.run.tenant)
      .header("x-rb-request-id", c.run.requestId)
      .header("x-rb-account", String(c.run.account))
      .okWith(items.small, { echo: ["tenant", "requestId", "account"] }),
});
