// Fastify's own query binding: a JSON Schema on the route, compiled and run by the ajv it
// already bundles.
//
// Declaring `schema.querystring` is the whole wiring. ajv runs with coerceTypes: 'array'
// and removeAdditional: true, which are Fastify's own defaults, so a declared integer
// arrives as a number and anything undeclared is dropped before the handler sees it. The
// handler answers req.query, which is what the schema left.
//
// No `required`, so Fastify decides what a missing parameter is: the property is simply
// absent. A value it cannot coerce is FST_ERR_VALIDATION, Fastify's own envelope, not this
// repository's. The endpoint set sends neither.

const page = { type: "integer" };

/** query.one: one parameter, and nothing else survives the schema. */
export const bindsOne = {
  schema: { querystring: { type: "object", properties: { page } } },
};

/** query.many: eight parameters, mixed types. */
export const bindsMany = {
  schema: {
    querystring: {
      type: "object",
      properties: {
        page,
        size: { type: "integer" },
        status: { type: "string" },
        category: { type: "string" },
        sort: { type: "string" },
        q: { type: "string" },
        min_price: { type: "integer" },
        max_price: { type: "integer" },
      },
    },
  },
};

/** What domain.filter pages by. */
export const bindsFilter = {
  schema: {
    querystring: {
      type: "object",
      properties: { page, size: { type: "integer" }, status: { type: "string" } },
    },
  },
};
