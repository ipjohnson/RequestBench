import type { Routes } from "../app.ts";

/** headers: /headers reads no header, and /headers/bind reads three with ctx.get and converts the account, because Koa binds nothing. */
const headers: Routes = (router, { payloads: p }) => {
  router.get("/headers", (ctx) => {
    ctx.body = p.small;
  });

  router.get("/headers/bind", (ctx) => {
    ctx.body = {
      ...p.small,
      echo: { tenant: ctx.get("x-rb-tenant"), requestId: ctx.get("x-rb-request-id"), account: Number(ctx.get("x-rb-account")) },
    };
  });
};

export default headers;
