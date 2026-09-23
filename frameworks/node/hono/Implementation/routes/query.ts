import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import type { Routes } from "../app.ts";

// rb:wiring query.*
/**
 * The query string as each route binds it. zValidator's query target hands zod the parsed query,
 * whose values are strings, and zod converts the numbers to integers, so c.req.valid is the echo.
 */
const integer = z.coerce.number().int();

const page = z.object({ page: integer });

/** query.many's eight values, which forms.urlencoded posts as a form. */
export const search = z.object({
  page: integer,
  size: integer,
  status: z.string(),
  category: z.string(),
  sort: z.string(),
  q: z.string(),
  minPrice: integer,
  maxPrice: integer,
});
// rb:end

/** query: query string values bound by zValidator and echoed back. */
const query: Routes = (app, p) => {
  app.get("/query/one", zValidator("query", page), (c) => c.json({ ...p.small, echo: c.req.valid("query") }));

  app.get("/query/many", zValidator("query", search), (c) => c.json({ ...p.small, echo: c.req.valid("query") }));
};

export default query;
