import type { FastifyRequest } from "fastify";

import type { Routes } from "../app.ts";
import { answers, integer, string } from "../schemas.ts";

/** The body the bind and validate rows send. */
interface Order {
  readonly customerId: number;
  readonly status: string;
  readonly lines: readonly { readonly productId: number; readonly qty: number }[];
}

// rb:wiring body.*
/**
 * The rules orderRequest states, as a JSON Schema. Fastify compiles it with ajv when the route is
 * registered and runs it before the handler, so no handler calls a validator and a body that
 * fails never reaches one. ajv stops at the first rule that fails, which is Fastify's setting.
 */
const order = {
  type: "object",
  properties: {
    customerId: { type: "integer", exclusiveMinimum: 0 },
    status: { type: "string", minLength: 1 },
    lines: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          productId: { type: "integer", exclusiveMinimum: 0 },
          qty: { type: "integer", exclusiveMinimum: 0 },
        },
        required: ["productId", "qty"],
        additionalProperties: false,
      },
    },
  },
  required: ["customerId", "status", "lines"],
  additionalProperties: false,
} as const;
// rb:end

/** What a bind or validate row answers: the order back, with the leaves the handler found in it and the bytes it received. */
const bound = { type: "object", properties: { fields: integer, bytes: integer, echo: order } } as const;

/** customerId and status, and a productId and a qty per line. */
function boundOf(request: FastifyRequest<{ Body: Order }>) {
  return {
    fields: 2 + 2 * request.body.lines.length,
    bytes: Number(request.headers["content-length"] ?? 0),
    echo: request.body,
  };
}

/**
 * body: the order parsed by Fastify's JSON parser on every route, and validated by its schema on
 * the validate routes. A body the parser cannot read is refused before any schema runs.
 */
const body: Routes = async (app) => {
  app.post<{ Body: Order }>("/body/bind/small", answers(bound), async (request) => boundOf(request));

  app.post<{ Body: Order }>("/body/bind/medium", answers(bound), async (request) => boundOf(request));

  // rb:wiring body.*
  const validated = { schema: { body: order, response: { 200: bound } } };

  app.post<{ Body: Order }>("/body/validate/small", validated, async (request) => boundOf(request));

  app.post<{ Body: Order }>("/body/validate/medium", validated, async (request) => boundOf(request));

  // The same schema as the other two. Fastify's ajv reports the first failure on every route.
  app.post<{ Body: Order }>("/body/validate/first-error", validated, async (request) => boundOf(request));
};

export default body;
