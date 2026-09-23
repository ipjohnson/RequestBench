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

/** A query string or a form as Koa parses one: every value a string, or a list of them for a repeated key. */
type Parsed = Readonly<Record<string, string | string[] | undefined>>;

const text = (value: string | string[] | undefined): string => (Array.isArray(value) ? value[0] : value) ?? "";

/** query.many's values, with the four numbers converted, because Koa binds nothing. */
export function search(parsed: Parsed): Search {
  return {
    page: Number(text(parsed["page"])),
    size: Number(text(parsed["size"])),
    status: text(parsed["status"]),
    category: text(parsed["category"]),
    sort: text(parsed["sort"]),
    q: text(parsed["q"]),
    minPrice: Number(text(parsed["minPrice"])),
    maxPrice: Number(text(parsed["maxPrice"])),
  };
}

/** query: Koa parses the query string into ctx.query, and the handler converts the numbers. */
const query: Routes = (router, { payloads: p }) => {
  router.get("/query/one", (ctx) => {
    ctx.body = { ...p.small, echo: { page: Number(text(ctx.query["page"])) } };
  });

  router.get("/query/many", (ctx) => {
    ctx.body = { ...p.small, echo: search(ctx.query) };
  });
};

export default query;
