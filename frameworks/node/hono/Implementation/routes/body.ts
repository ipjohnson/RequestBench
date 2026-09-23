// rb:wiring body.*
import { zValidator } from "@hono/zod-validator";
import type { Context } from "hono";
import { z } from "zod";

import type { Routes } from "../app.ts";

// rb:wiring body.*
/**
 * The rules orderRequest states, as a zod schema. zValidator runs it on the parsed body before the
 * handler and answers a body that fails with 400 and zod's error, so no handler calls a validator
 * and a body that fails never reaches one. zod checks every field and reports each that fails.
 */
const order = z.strictObject({
  customerId: z.int().positive(),
  status: z.string().min(1),
  lines: z.array(z.strictObject({ productId: z.int().positive(), qty: z.int().positive() })).min(1),
});
// rb:end

type Order = z.infer<typeof order>;

/** What a bind or validate row answers: the order back, with the leaves the handler found in it and the bytes it received. */
function bound(c: Context, echo: Order): Response {
  return c.json({ fields: 2 + 2 * echo.lines.length, bytes: Number(c.req.header("content-length") ?? 0), echo });
}

/**
 * body: the order parsed by Hono's JSON reader on every route, and validated by zValidator on the
 * validate routes. A body the reader cannot parse is refused before any schema runs.
 */
const body: Routes = (app) => {
  app.post("/body/bind/small", async (c) => bound(c, await c.req.json<Order>()));

  app.post("/body/bind/medium", async (c) => bound(c, await c.req.json<Order>()));

  // rb:wiring body.*
  const validated = zValidator("json", order);

  app.post("/body/validate/small", validated, (c) => bound(c, c.req.valid("json")));

  app.post("/body/validate/medium", validated, (c) => bound(c, c.req.valid("json")));

  // rb:wiring body.*
  // zod has no setting that stops at the first failure, so this route runs the validator one field
  // at a time, in the order orderRequest declares them, and the first to fail answers. The last
  // step is the whole order, which also refuses a key the order does not have. Hono parses the
  // body once and each step reads the parse.
  const firstFailure = [
    zValidator("json", z.object({ customerId: order.shape.customerId })),
    zValidator("json", z.object({ status: order.shape.status })),
    validated,
  ] as const;

  app.post("/body/validate/first-error", ...firstFailure, (c) => bound(c, c.req.valid("json")));
};

export default body;
