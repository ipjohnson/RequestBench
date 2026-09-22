import type { Routes } from "../app.ts";
import { echoed, integer, string } from "../schemas.ts";

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

// rb:wiring query.*
/**
 * The query string as each route binds it. Fastify runs a querystring schema with ajv before the
 * handler, and ajv converts what it declares as an integer, so request.query is already the echo.
 */
const page = { type: "object", properties: { page: integer }, required: ["page"] } as const;

export const search = {
  type: "object",
  properties: {
    page: integer,
    size: integer,
    status: string,
    category: string,
    sort: string,
    q: string,
    minPrice: integer,
    maxPrice: integer,
  },
  required: ["page", "size", "status", "category", "sort", "q", "minPrice", "maxPrice"],
} as const;
// rb:end

/** query: query string values bound by the route's schema and echoed back. */
const query: Routes = async (app, { payloads: p }) => {
  app.get<{ Querystring: { page: number } }>("/query/one", {
    schema: { querystring: page, response: { 200: echoed(page) } },
  }, async (request) => ({ ...p.small, echo: request.query }));

  app.get<{ Querystring: Search }>("/query/many", {
    schema: { querystring: search, response: { 200: echoed(search) } },
  }, async (request) => ({ ...p.small, echo: request.query }));
};

export default query;
