import type { Routes } from "../app.ts";
import { answers, echoed, integer, payload } from "../schemas.ts";

// rb:wiring parameters.*
/**
 * The captures as each route binds them. Fastify runs a params schema with ajv before the
 * handler, and ajv converts what it declares as an integer, so the handler reads numbers.
 */
const one = { type: "object", properties: { one: integer }, required: ["one"] } as const;

const two = { type: "object", properties: { one: integer, two: integer }, required: ["one", "two"] } as const;
// rb:end

/**
 * parameters: router captures, each echoed back as the integer its schema declares.
 * find-my-way tries a static segment before a capture, so the static path reaches its own route.
 */
const parameters: Routes = async (app, { payloads: p }) => {
  app.get("/parameters/static/segment/literal", answers(payload), async () => p.small);

  app.get<{ Params: { one: number } }>("/parameters/:one/segment/literal", {
    schema: { params: one, response: { 200: echoed(one) } },
  }, async (request) => ({ ...p.small, echo: request.params }));

  app.get<{ Params: { one: number; two: number } }>("/parameters/:one/with-second/:two", {
    schema: { params: two, response: { 200: echoed(two) } },
  }, async (request) => ({ ...p.small, echo: request.params }));
};

export default parameters;
