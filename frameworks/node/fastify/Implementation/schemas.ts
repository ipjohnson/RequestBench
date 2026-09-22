import fastJson from "fast-json-stringify";

export const integer = { type: "integer" } as const;
export const string = { type: "string" } as const;
export const boolean = { type: "boolean" } as const;

// rb:wiring json.*
/** One row of a payload. */
export const item = {
  type: "object",
  properties: { id: integer, name: string, category: string, priceCents: integer, inStock: boolean },
} as const;

/** items.small, items.medium and items.large, which every family built on the json family answers with. */
export const payload = {
  type: "object",
  properties: { size: string, count: integer, items: { type: "array", items: item } },
} as const;

/**
 * Route options declaring the body a route answers 200 with. Fastify compiles the schema with
 * fast-json-stringify when the route is registered, and the handler returns the object. The
 * compiled function writes only the properties the schema declares, in the order it declares them.
 */
export function answers<S>(schema: S) {
  return { schema: { response: { 200: schema } } };
}

/**
 * One row, by the function fast-json-stringify compiles from the row's schema, for the routes that
 * write rows one at a time and so have no response schema to declare.
 */
export const serializeItem = fastJson(item);
// rb:end

/** A payload with what a route bound written back in `echo`, declared by the schema it was bound with. */
export function echoed<S>(echo: S) {
  return { type: "object", properties: { ...payload.properties, echo } } as const;
}
