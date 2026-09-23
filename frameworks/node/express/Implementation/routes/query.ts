import type { Routes } from "../app.ts";

/** query.many's eight values, which forms.urlencoded posts as a form. */
export interface Search {
  readonly page: number;
  readonly size: number;
  readonly status: string;
  readonly category: string;
  readonly sort: string;
  readonly q: string;
  readonly minPrice: number;
  readonly maxPrice: number;
}

/**
 * query.many's eight values, the numbers converted. Express parses a query string, and
 * express.urlencoded a form, into strings, and converts nothing.
 */
export function search(values: Readonly<Record<string, unknown>>): Search {
  return {
    page: Number(values["page"]),
    size: Number(values["size"]),
    status: values["status"] as string,
    category: values["category"] as string,
    sort: values["sort"] as string,
    q: values["q"] as string,
    minPrice: Number(values["minPrice"]),
    maxPrice: Number(values["maxPrice"]),
  };
}

/**
 * query: query string values echoed back. Express 5 parses the query string with Node's
 * querystring, its "simple" parser, each time req.query is read, so each handler reads it once.
 */
const query: Routes = (app, p) => {
  app.get("/query/one", (request, response) => response.json({ ...p.small, echo: { page: Number(request.query["page"]) } }));

  app.get("/query/many", (request, response) => response.json({ ...p.small, echo: search(request.query) }));
};

export default query;
