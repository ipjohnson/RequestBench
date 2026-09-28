import { performanceTest } from "#kit";
import { items } from "#payloads";

const path = "/parameters/{run.one}/{run.two}/{run.three}";

export default performanceTest({
  id: { family: "parameters", name: "three" },
  path,
  base: "parameters.two",
  varies: "captures",
  heft: 1,
  about:
    "The same depth with three of its four segments captured, which leaves " +
    "parameters as the only static one. Read against parameters.two, the " +
    "difference is a third segment the router has to capture and a third " +
    "value the framework has to convert.",

  request: (c) =>
    c.get(`/parameters/${c.run.one}/${c.run.two}/${c.run.three}`).okWith(items.small, { echo: ["one", "two", "three"] }),
});
