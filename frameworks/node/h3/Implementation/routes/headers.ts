import type { H3Event } from "h3";

import type { Routes } from "../app.ts";

// rb:wiring headers.*
/**
 * h3 binds no headers. Its validation utilities cover the body, the query and the route's params,
 * and the experimental defineValidatedHandler writes validated headers back into the request as
 * strings. So the three are read from the request's Headers, and the account is converted here.
 */
function bound(event: H3Event) {
  const headers = event.req.headers;
  return {
    tenant: headers.get("x-rb-tenant"),
    requestId: headers.get("x-rb-request-id"),
    account: Number(headers.get("x-rb-account")),
  };
}
// rb:end

/** headers: /headers reads no header, and /headers/bind reads three. */
const headers: Routes = (app, p) => {
  app.get("/headers", () => p.small);

  app.get("/headers/bind", (event) => ({ ...p.small, echo: bound(event) }));
};

export default headers;
