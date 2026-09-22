import type { Routes } from "../app.ts";
import type { Item } from "../payloads.ts";
import { integer, item } from "../schemas.ts";

/** An item as a client creates or replaces one. */
type NewItem = Omit<Item, "id">;

/** The two fields items.update changes. */
type ItemPatch = Pick<Item, "priceCents" | "inStock">;

/** The id in the path, which ajv converts to an integer. */
const id = { type: "object", properties: { id: integer }, required: ["id"] } as const;

/**
 * items: every method on one resource over the rows of items.large. A measured row may not leave
 * the server changed, so the writes store nothing and answer as if they had written. A missing row
 * is @fastify/sensible's 404. Fastify answers a method the path has no route for with 404 on its own.
 */
const items: Routes = async (app, { payloads: p }) => {
  // Fastify gives every GET route a HEAD route, which runs this handler and sends no body.
  // rb:handler items.read,items.head
  app.get<{ Params: { id: number } }>("/items/:id", {
    schema: { params: id, response: { 200: item } },
  }, async (request, reply) => p.row(request.params.id) ?? reply.notFound());

  app.post<{ Body: NewItem }>("/items", { schema: { response: { 201: item } } }, async (request, reply) => {
    const created = p.large.count + 1;
    reply.code(201).header("location", `/items/${created}`);
    return { id: created, ...request.body };
  });

  app.put<{ Params: { id: number }; Body: NewItem }>("/items/:id", {
    schema: { params: id, response: { 200: item } },
  }, async (request) => ({ id: request.params.id, ...request.body }));

  app.patch<{ Params: { id: number }; Body: ItemPatch }>("/items/:id", {
    schema: { params: id, response: { 200: item } },
  }, async (request, reply) => {
    const row = p.row(request.params.id);
    return row === undefined ? reply.notFound() : { ...row, ...request.body };
  });

  app.delete<{ Params: { id: number } }>("/items/:id", { schema: { params: id } }, async (request, reply) =>
    p.row(request.params.id) === undefined ? reply.notFound() : reply.code(204).send());
};

export default items;
