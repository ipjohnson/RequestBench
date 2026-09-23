import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import type { Routes } from "../app.ts";
import type { Item } from "../payloads.ts";

/** An item as a client creates or replaces one. */
type NewItem = Omit<Item, "id">;

/** The two fields items.update changes. */
type ItemPatch = Pick<Item, "priceCents" | "inStock">;

/** The id in the path, which zod converts to an integer. */
const id = zValidator("param", z.object({ id: z.coerce.number().int() }));

/**
 * items: every method on one resource over the rows of items.large. A measured row may not leave
 * the server changed, so the writes store nothing and answer as if they had written. A missing row
 * is c.notFound(), the application's not-found answer. Hono answers a method the path has no route
 * for with 404 on its own.
 */
const items: Routes = (app, p) => {
  // Hono answers HEAD by running the GET route and sending its headers with no body.
  // rb:handler items.read,items.head
  app.get("/items/:id", id, (c) => {
    const row = p.row(c.req.valid("param").id);
    return row === undefined ? c.notFound() : c.json(row);
  });

  app.post("/items", async (c) => {
    const created = p.large.count + 1;
    c.header("location", `/items/${created}`);
    return c.json({ id: created, ...(await c.req.json<NewItem>()) }, 201);
  });

  app.put("/items/:id", id, async (c) => c.json({ id: c.req.valid("param").id, ...(await c.req.json<NewItem>()) }));

  app.patch("/items/:id", id, async (c) => {
    const row = p.row(c.req.valid("param").id);
    return row === undefined ? c.notFound() : c.json({ ...row, ...(await c.req.json<ItemPatch>()) });
  });

  app.delete("/items/:id", id, (c) => (p.row(c.req.valid("param").id) === undefined ? c.notFound() : c.body(null, 204)));
};

export default items;
