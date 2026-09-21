import { performanceTest } from "#kit";
import { items } from "#payloads";

const path = "/forms/urlencoded";
const FIELDS = ["page", "size", "status", "category", "sort", "q", "minPrice", "maxPrice"] as const;

export default performanceTest({
  id: { family: "forms", name: "urlencoded" },
  path,
  about:
    "query.many's eight fields posted as an application/x-www-form-urlencoded " +
    "body instead of a query string, bound and echoed. The answer is exactly " +
    "what query.many answers, so the difference between the two is the form " +
    "parser against the query parser.",

  request: (c) => {
    const form = new URLSearchParams(FIELDS.map((name) => [name, String(c.run[name])])).toString();
    return c.post(path).raw(form, "application/x-www-form-urlencoded").okWith(items.small, { echo: FIELDS });
  },
});
