import { performanceTest } from "#kit";
import { items } from "#payloads";

const path = "/query/many?page={run.page}&size={run.size}&status={run.status}&category={run.category}&sort={run.sort}&q={run.q}&minPrice={run.minPrice}&maxPrice={run.maxPrice}";

export default performanceTest({
  id: { family: "query", name: "many" },
  path,
  about:
    "Eight parameters, which is what a real search endpoint carries: a page " +
    "and a size, a sort, a text term and four filters. Read against " +
    "query.one, the difference is seven more keys parsed, coerced and echoed.",

  request: (c) =>
    c
      .get("/query/many")
      .query("page", String(c.run.page))
      .query("size", String(c.run.size))
      .query("status", c.run.status)
      .query("category", c.run.category)
      .query("sort", c.run.sort)
      .query("q", c.run.q)
      .query("minPrice", String(c.run.minPrice))
      .query("maxPrice", String(c.run.maxPrice))
      .okWith(items.small, { echo: ["page", "size", "status", "category", "sort", "q", "minPrice", "maxPrice"] }),
});
