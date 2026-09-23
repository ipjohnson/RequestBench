import { getValidatedRouterParams, HTTPError, noContent, readBody } from "h3";
import { z } from "zod";

import type { Routes } from "../app.ts";
import type { Item } from "../payloads.ts";

/** An item as a client creates or replaces one. */
type NewItem = Omit<Item, "id">;

/** The two fields items.update changes. */
type ItemPatch = Pick<Item, "priceCents" | "inStock">;

/** The id in the path, which zod converts to an integer. */
const id = z.object({ id: z.coerce.number().int() });

/**
 * items: every method on one resource over the rows of items.large. A measured row may not leave the
 * server changed, so the writes store nothing and answer as if they had written. A missing row is
 * h3's HTTPError with 404. h3 answers a method the path has no route for with 404 on its own.
 */
const items: Routes = (app, p) => {
  // h3 serves HEAD with the GET route, which runs this handler and sends no body.
  // rb:handler items.read,items.head
  app.get("/items/:id", async (event) => {
    const row = p.row((await getValidatedRouterParams(event, id)).id);
    if (row === undefined) throw HTTPError.status(404, "Not Found");
    return row;
  });

  app.post("/items", async (event) => {
    const created = p.large.count + 1;
    event.res.status = 201;
    event.res.headers.set("location", `/items/${created}`);
    return { id: created, ...(await readBody<NewItem>(event)) };
  });

  app.put("/items/:id", async (event) => ({ id: (await getValidatedRouterParams(event, id)).id, ...(await readBody<NewItem>(event)) }));

  app.patch("/items/:id", async (event) => {
    const row = p.row((await getValidatedRouterParams(event, id)).id);
    if (row === undefined) throw HTTPError.status(404, "Not Found");
    return { ...row, ...(await readBody<ItemPatch>(event)) };
  });

  app.delete("/items/:id", async (event) => {
    if (p.row((await getValidatedRouterParams(event, id)).id) === undefined) throw HTTPError.status(404, "Not Found");
    return noContent();
  });
};

export default items;
