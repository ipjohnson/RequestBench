import express, { type Request, type RequestHandler, type Response } from "express";
// rb:wiring body.*
import { checkSchema, validationResult } from "express-validator";

import type { Routes } from "../app.ts";

/** The body the bind and validate rows send. */
interface Order {
  readonly customerId: number;
  readonly status: string;
  readonly lines: readonly { readonly productId: number; readonly qty: number }[];
}

/** express.json() in each body route's handler list, rather than on the application, so no other route looks for a body. */
const parse = express.json();

// rb:wiring body.*
/**
 * The rules orderRequest states, as an express-validator schema: a chain of checks for each field.
 * The checks validator.js provides, such as isInt, read the value's string form. A field the schema
 * does not name is let through.
 */
const order = checkSchema({
  customerId: { isInt: { options: { gt: 0 } } },
  status: { isString: true, notEmpty: true },
  lines: { isArray: { options: { min: 1 } } },
  "lines.*.productId": { isInt: { options: { gt: 0 } } },
  "lines.*.qty": { isInt: { options: { gt: 0 } } },
}, ["body"]);

/**
 * Every chain, each run as middleware, then a body any of them failed refused with every error they
 * collected, as express-validator's guide refuses one: 400, with result.array() as `errors`.
 */
const everyError = [...order, ((request, response, next) => {
  const result = validationResult(request);
  if (result.isEmpty()) next();
  else response.status(400).json({ errors: result.array() });
}) satisfies RequestHandler];

/** The chains one at a time, stopping at the first that fails, as express-validator's guide runs them to stop early. */
const firstError: RequestHandler = async (request, response, next) => {
  for (const chain of order) {
    const result = await chain.run(request);
    if (!result.isEmpty()) {
      response.status(400).json({ errors: result.array() });
      return;
    }
  }
  next();
};
// rb:end

/** What a bind or validate row answers: customerId and status and a productId and a qty per line, the bytes received, and the order back. */
function bound(request: Request<Record<string, string>, unknown, Order>, response: Response): void {
  response.json({
    fields: 2 + 2 * request.body.lines.length,
    bytes: Number(request.get("content-length") ?? 0),
    echo: request.body,
  });
}

/**
 * body: the order parsed by express.json() on every route, and checked by express-validator on the
 * validate routes before the handler. A body the parser cannot read never reaches a chain.
 */
const body: Routes = (app) => {
  app.post("/body/bind/small", parse, bound);

  app.post("/body/bind/medium", parse, bound);

  app.post("/body/validate/small", parse, everyError, bound);

  app.post("/body/validate/medium", parse, everyError, bound);

  // The same rules as the other two, run one chain at a time, so the first failure ends the check.
  app.post("/body/validate/first-error", parse, firstError, bound);
};

export default body;
