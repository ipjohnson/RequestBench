import type { Routes } from "../app.ts";

/**
 * headers: /headers reads no header, and /headers/bind reads three. Express binds no header, so
 * the handler reads each with req.get and converts the account itself.
 */
const headers: Routes = (app, p) => {
  app.get("/headers", (_request, response) => response.json(p.small));

  app.get("/headers/bind", (request, response) => response.json({
    ...p.small,
    echo: {
      tenant: request.get("x-rb-tenant"),
      requestId: request.get("x-rb-request-id"),
      account: Number(request.get("x-rb-account")),
    },
  }));
};

export default headers;
