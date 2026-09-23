import { getValidatedQuery } from "h3";
import { z } from "zod";

import type { Routes } from "../app.ts";

// rb:wiring query.*
/**
 * The query string as each route binds it. getValidatedQuery hands the parsed query to a zod schema,
 * which converts the numbers to integers, and throws h3's validation error when one is not.
 */
const page = z.object({ page: z.coerce.number().int() });

/** query.many's eight values, which forms.urlencoded posts as a form. */
export const search = z.object({
  page: z.coerce.number().int(),
  size: z.coerce.number().int(),
  status: z.string(),
  category: z.string(),
  sort: z.string(),
  q: z.string(),
  minPrice: z.coerce.number().int(),
  maxPrice: z.coerce.number().int(),
});
// rb:end

/** query: query string values bound by the route's schema and echoed back. */
const query: Routes = (app, p) => {
  app.get("/query/one", async (event) => ({ ...p.small, echo: await getValidatedQuery(event, page) }));

  app.get("/query/many", async (event) => ({ ...p.small, echo: await getValidatedQuery(event, search) }));
};

export default query;
