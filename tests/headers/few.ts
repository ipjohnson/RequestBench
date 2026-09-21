import { performanceTest } from "#kit";
import { items } from "#payloads";

const path = "/headers";

export default performanceTest({
  id: { family: "headers", name: "few" },
  path,
  about:
    "Five request headers, none of which the handler reads. Two of the five " +
    "are what an HTTP client adds itself, and the other three are the ones " +
    "the binding rows bind. This is what headers.many is subtracted from.",

  request: (c) =>
    c
      .get(path)
      .header("x-rb-tenant", c.run.tenant)
      .header("x-rb-request-id", c.run.requestId)
      .header("x-rb-account", String(c.run.account))
      .okWith(items.small),
});
