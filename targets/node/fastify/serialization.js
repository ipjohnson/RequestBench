// Fastify's own serializer: a response schema on the route, which Fastify compiles once with
// fast-json-stringify into the function that writes the body.
//
// Declaring `schema.response` is the whole wiring. A handler still returns the object, and no
// handler calls a serializer. fast-json-stringify writes only the properties a schema
// declares, in the order it declares them, so each schema here lists every property of its
// body in the order the object holds them. A status with no schema of its own is written by
// JSON.stringify.

const integer = { type: "integer" };
const string = { type: "string" };

// rb:wiring json.*
/** The three payloads, which every family built on the json family reuses unchanged. */
export const payload = {
  type: "object",
  properties: {
    count: integer,
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: string, id: integer, in_stock: { type: "boolean" }, name: string,
          price_cents: integer,
        },
      },
    },
    size: string,
  },
};

/** A payload with what a route bound beside it, declared as the route binds it. */
export const withEcho = (echo) => ({
  type: "object",
  properties: { ...payload.properties, echo: { type: "object", properties: echo } },
});

/** headers.bind_*: the three headers the route converts. */
export const headersEcho = withEcho({ tenant: string, request_id: string, account: integer });

/** The 403 and 404 bodies a handler or a hook answers. */
export const refusal = { type: "object", properties: { error: string } };

/** What setErrorHandler answers for an error Fastify raised itself, such as a failed schema. */
export const envelope = {
  type: "object",
  properties: { statusCode: integer, code: string, error: string, message: string },
};

/** body.bind_*: the body is echoed as it arrived, so `echo` is `{}`, which takes any value. */
export const bound = {
  type: "object",
  properties: { fields: integer, bytes: integer, echo: {} },
};

/** An order once priceOrder has run: body.validate_* and domain.create. */
export const pricedOrder = {
  type: "object",
  properties: {
    customer_id: integer,
    status: string,
    lines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: integer, product_id: integer, qty: integer, unit_cents: integer,
          total_cents: integer,
        },
      },
    },
    total_cents: integer,
  },
};

/** domain.replace: the priced order under the id it replaced. */
export const replacedOrder = {
  type: "object",
  properties: { id: integer, ...pricedOrder.properties },
};

/** A fixture order, as domain.lookup answers it and domain.filter lists it. */
export const order = {
  type: "object",
  properties: {
    created: string,
    customer_id: integer,
    id: integer,
    lines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: integer, product_id: integer, qty: integer, total_cents: integer,
          unit_cents: integer,
        },
      },
    },
    status: string,
    total_cents: integer,
  },
};

/** domain.filter: one page of orders. */
export const orderPage = {
  type: "object",
  properties: { page: integer, size: integer, total: integer, items: { type: "array", items: order } },
};

/** A fixture customer, as domain.patch answers it and domain.join nests it. */
export const customer = {
  type: "object",
  properties: { created: string, email: string, id: integer, name: string, region: string },
};

/** domain.join. */
export const customerSummary = {
  type: "object",
  properties: {
    customer,
    order_count: integer,
    lifetime_cents: integer,
    line_count: integer,
    units: integer,
    recent: {
      type: "array",
      items: { type: "object", properties: { id: integer, created: string, total_cents: integer } },
    },
  },
};

/** domain.aggregate. */
export const regionReport = {
  type: "object",
  properties: {
    region: string,
    customers: integer,
    orders: integer,
    revenue_cents: integer,
    top: {
      type: "array",
      items: { type: "object", properties: { id: integer, total_cents: integer } },
    },
  },
};

// rb:wiring json.*
/** Route options with `schema.response` added to whatever else the route declares. */
export const responds = (response, options = {}) =>
  ({ ...options, schema: { ...options.schema, response } });
