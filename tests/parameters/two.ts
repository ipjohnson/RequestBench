import { performanceTest } from "#kit";
import { items } from "#payloads";

const path = "/parameters/{run.one}/with-second/{run.two}";

export default performanceTest({
  id: { family: "parameters", name: "two" },
  path,
  about:
    "The same depth with a second capture in it. Read against parameters.one, " +
    "the difference is one more segment the router has to capture and one " +
    "more value the framework has to convert.",

  request: (c) =>
    c.get(`/parameters/${c.run.one}/with-second/${c.run.two}`).okWith(items.small, { echo: ["one", "two"] }),
});
