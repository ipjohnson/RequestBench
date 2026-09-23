import express, { type Request } from "express";

import type { Routes } from "../app.ts";
import type { Item } from "../payloads.ts";

/** An item as a client creates or replaces one. */
type NewItem = Omit<Item, "id">;

/** The two fields items.update changes. */
type ItemPatch = Pick<Item, "priceCents" | "inStock">;

/**
 * items: every method on one resource over the rows of items.large. A measured row may not leave
 * the server changed, so the writes store nothing and answer as if they had written. A missing row
 * is res.sendStatus(404). Express's router matches the method and the path together, so a method the
 * path has no route for reaches the final handler's 404.
 */
const items: Routes = (app, p) => {
  const parse = express.json();

  // Express answers HEAD with this route, and res.send writes the headers and leaves out the body.
  // rb:handler items.read,items.head
  app.get("/items/:id", (request, response) => {
    const row = p.row(Number(request.params.id));
    if (row === undefined) response.sendStatus(404);
    else response.json(row);
  });

  app.post("/items", parse, (request: Request<Record<string, string>, Item, NewItem>, response) => {
    const created = p.large.count + 1;
    response.status(201).location(`/items/${created}`).json({ id: created, ...request.body });
  });

  app.put("/items/:id", parse, (request: Request<{ id: string }, Item, NewItem>, response) =>
    response.json({ id: Number(request.params.id), ...request.body }));

  app.patch("/items/:id", parse, (request: Request<{ id: string }, Item, ItemPatch>, response) => {
    const row = p.row(Number(request.params.id));
    if (row === undefined) response.sendStatus(404);
    else response.json({ ...row, ...request.body });
  });

  app.delete("/items/:id", (request, response) =>
    response.sendStatus(p.row(Number(request.params.id)) === undefined ? 404 : 204));
};

export default items;
