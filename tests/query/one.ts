import { performanceTest } from "#kit";
import { items } from "#payloads";

const path = "/query/one?page={run.page}";

export default performanceTest({
  id: { family: "query", name: "one" },
  path,
  about:
    "One query parameter parsed, coerced to an integer and written back. Read " +
    "against json.small, the difference is the query string being parsed at " +
    "all.",

  request: (c) => c.get("/query/one").query("page", String(c.run.page)).okWith(items.small, { echo: ["page"] }),
});
