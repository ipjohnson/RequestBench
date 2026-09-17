// Fastify's own validation: a JSON Schema on the route, compiled and run by the ajv it
// already bundles.
//
// Declaring `schema.body` is the whole wiring. Fastify compiles it once at registration and
// runs it before the handler, so there is no validator call in any handler and a body that
// fails never reaches one. What it answers on failure is Fastify's own FST_ERR_VALIDATION
// envelope, not this repository's.
import * as d from "../_shared/domain.js";

/**
 * The order body as a schema.
 *
 * `required` is how JSON Schema says present, so nothing here needs the nullable-pointer
 * trick a typed binder does. ajv's default in Fastify is allErrors: false, so it reports the
 * first failure it finds; that is the framework's setting and it is left alone.
 */
export const orderSchema = {
  type: "object",
  required: ["customer_id", "status", "lines"],
  properties: {
    customer_id: { type: "integer" },
    status: { type: "string" },
    lines: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["product_id", "qty"],
        properties: {
          product_id: { type: "integer" },
          qty: { type: "integer", minimum: 1 },
        },
      },
    },
  },
};

/** What a route declares to get the schema run before its handler. */
export const validatesOrder = { schema: { body: orderSchema } };

/** The order, once ajv has said the body is one. */
export const orderOf = (body) => d.priceOrder(body.customer_id, body.status, body.lines);
