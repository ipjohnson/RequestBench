import { bodyParser } from "@koa/bodyparser";

import type { Routes } from "../app.ts";
import type { Item } from "../payloads.ts";

/** An item as a client creates or replaces one. */
type NewItem = Omit<Item, "id">;

/** The two fields items.update changes. */
type ItemPatch = Pick<Item, "priceCents" | "inStock">;

/**
 * items: every method on one resource over the rows of items.large. A measured row may not leave
 * the server changed, so the writes store nothing and answer as if they had written. A missing row
 * is ctx.throw's 404, which Koa's error handling writes.
 */
const items: Routes = (router, { payloads: p }) => {
  const parse = bodyParser({ enableTypes: ["json"] });

  // The id in the path, converted once by the router's hook for it and kept on ctx.state.
  router.param("id", (value, ctx, next) => {
    ctx.state.id = Number(value);
    return next();
  });

  // @koa/router answers HEAD with a GET route, and Koa sends the headers the body would have had.
  // rb:handler items.read,items.head
  router.get("/items/:id", (ctx) => {
    ctx.body = p.row(ctx.state.id) ?? ctx.throw(404);
  });

  router.post("/items", parse, (ctx) => {
    const created = p.large.count + 1;
    ctx.status = 201;
    ctx.set("location", `/items/${created}`);
    ctx.body = { id: created, ...(ctx.request.body as NewItem) };
  });

  router.put("/items/:id", parse, (ctx) => {
    ctx.body = { id: ctx.state.id, ...(ctx.request.body as NewItem) };
  });

  router.patch("/items/:id", parse, (ctx) => {
    ctx.body = { ...(p.row(ctx.state.id) ?? ctx.throw(404)), ...(ctx.request.body as ItemPatch) };
  });

  router.delete("/items/:id", (ctx) => {
    if (p.row(ctx.state.id) === undefined) ctx.throw(404);
    ctx.status = 204;
  });
};

export default items;
