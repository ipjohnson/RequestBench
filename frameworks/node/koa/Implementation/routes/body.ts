import { bodyParser } from "@koa/bodyparser";
import type { Context } from "koa";
// rb:wiring body.*
import parameter from "koa-parameter";

import type { Routes } from "../app.ts";

declare module "koa" {
  interface DefaultContext {
    /** koa-parameter's check of the parsed body against the parameter library's rules, which throws every failure. */
    verifyParams(rules: Readonly<Record<string, unknown>>): void;
  }
}

/** The body the bind and validate rows send. */
interface Order {
  readonly customerId: number;
  readonly status: string;
  readonly lines: readonly { readonly productId: number; readonly qty: number }[];
}

// rb:wiring body.*
/**
 * The rules orderRequest states, in the rule language of the parameter library, which koa-parameter
 * runs. A rule is required unless it says otherwise, and a string may not be empty unless it says so.
 */
const order = {
  customerId: { type: "int", min: 1 },
  status: { type: "string" },
  lines: {
    type: "array",
    itemType: "object",
    min: 1,
    rule: { productId: { type: "int", min: 1 }, qty: { type: "int", min: 1 } },
  },
} as const;
// rb:end

/** What a bind or validate row answers: the order back, with the leaves the handler found in it and the bytes it received. */
function bound(ctx: Context): void {
  const received = ctx.request.body as Order;
  ctx.body = { fields: 2 + 2 * received.lines.length, bytes: ctx.request.length, echo: received };
}

/**
 * body: the order parsed by @koa/bodyparser on every route, and checked by koa-parameter on the
 * validate routes. A body the parser cannot read is refused before any rule runs.
 */
const body: Routes = (router, { app }) => {
  // rb:wiring body.*
  // Route middleware each, so no other route parses a body or answers koa-parameter's failure.
  // koa-parameter puts verifyParams on the application's context, and returns the middleware that
  // answers its failure with 422 and the parameter library's list of failures.
  const parse = bodyParser({ enableTypes: ["json"] });
  const verified = parameter(app);
  // rb:end

  router.post("/body/bind/small", parse, bound);

  router.post("/body/bind/medium", parse, bound);

  router.post("/body/validate/small", parse, verified, (ctx) => {
    ctx.verifyParams(order);
    bound(ctx);
  });

  router.post("/body/validate/medium", parse, verified, (ctx) => {
    ctx.verifyParams(order);
    bound(ctx);
  });

  // The parameter library checks every rule it is given and has no setting that stops it at the
  // first failure, so this route hands it one field's rule at a time and stops at the first that fails.
  router.post("/body/validate/first-error", parse, verified, (ctx) => {
    for (const [field, rule] of Object.entries(order)) ctx.verifyParams({ [field]: rule });
    bound(ctx);
  });
};

export default body;
