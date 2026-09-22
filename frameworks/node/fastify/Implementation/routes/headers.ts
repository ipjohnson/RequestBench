import type { Routes } from "../app.ts";
import { answers, echoed, integer, payload, string } from "../schemas.ts";

// rb:wiring headers.*
/**
 * The three headers the route binds. Fastify runs a headers schema with ajv against
 * request.headers before the handler, and ajv converts x-rb-account to an integer there.
 */
const bound = {
  type: "object",
  properties: { "x-rb-tenant": string, "x-rb-request-id": string, "x-rb-account": integer },
  required: ["x-rb-tenant", "x-rb-request-id", "x-rb-account"],
} as const;
// rb:end

const echo = { type: "object", properties: { tenant: string, requestId: string, account: integer } } as const;

interface Bound {
  readonly "x-rb-tenant": string;
  readonly "x-rb-request-id": string;
  readonly "x-rb-account": number;
}

/** headers: /headers reads no header, and /headers/bind binds three through its schema. */
const headers: Routes = async (app, { payloads: p }) => {
  app.get("/headers", answers(payload), async () => p.small);

  app.get<{ Headers: Bound }>("/headers/bind", {
    schema: { headers: bound, response: { 200: echoed(echo) } },
  }, async (request) => ({
    ...p.small,
    echo: {
      tenant: request.headers["x-rb-tenant"],
      requestId: request.headers["x-rb-request-id"],
      account: request.headers["x-rb-account"],
    },
  }));
};

export default headers;
