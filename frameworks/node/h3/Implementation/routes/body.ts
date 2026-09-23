import { readBody, readValidatedBody, type H3Event } from "h3";
import { z } from "zod";

import type { Routes } from "../app.ts";

/** The body the bind and validate rows send. */
interface Order {
  readonly customerId: number;
  readonly status: string;
  readonly lines: readonly { readonly productId: number; readonly qty: number }[];
}

// rb:wiring body.*
/**
 * The rules orderRequest states, as a zod schema. h3 validates through Standard Schema, and zod is
 * the library its validation guide shows first. readValidatedBody reads the body, runs the schema
 * and throws h3's validation error when it fails, naming every field that failed.
 */
const order = z.strictObject({
  customerId: z.number().int().positive(),
  status: z.string().min(1),
  lines: z.array(z.strictObject({ productId: z.number().int().positive(), qty: z.number().int().positive() })).min(1),
});

/** One field's rules, in an object schema that lets the other fields through. */
const only = (shape: Record<string, z.ZodType>): z.ZodType<object, object> => z.looseObject(shape);

/**
 * The same rules, one field at a time. zod checks every field of an object and has no setting that
 * stops at the first failure, so each field's schema is piped into the next, and zod stops at the
 * first that fails.
 */
const firstError = only({ customerId: order.shape.customerId })
  .pipe(only({ status: order.shape.status }))
  .pipe(only({ lines: order.shape.lines }));
// rb:end

/** What a bind or validate row answers: the order back, with the leaves the handler found in it and the bytes it received. */
function boundOf(event: H3Event, order: Order) {
  return {
    fields: 2 + 2 * order.lines.length,
    bytes: Number(event.req.headers.get("content-length") ?? 0),
    echo: order,
  };
}

/**
 * body: the order parsed by h3's readBody on every route, and validated by its schema on the validate
 * routes. A body readBody cannot parse is refused before any schema runs.
 */
const body: Routes = (app) => {
  app.post("/body/bind/small", async (event) => boundOf(event, (await readBody<Order>(event))!));

  app.post("/body/bind/medium", async (event) => boundOf(event, (await readBody<Order>(event))!));

  app.post("/body/validate/small", async (event) => boundOf(event, await readValidatedBody(event, order)));

  app.post("/body/validate/medium", async (event) => boundOf(event, await readValidatedBody(event, order)));

  app.post("/body/validate/first-error", async (event) => boundOf(event, (await readValidatedBody(event, firstError)) as Order));
};

export default body;
