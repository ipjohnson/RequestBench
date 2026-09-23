import type { Routes } from "../app.ts";

/** json: a payload the framework already holds, which Koa writes with JSON.stringify once the handler has returned. */
const json: Routes = (router, { payloads: p }) => {
  router.get("/json/small", (ctx) => {
    ctx.body = p.small;
  });

  router.get("/json/medium", (ctx) => {
    ctx.body = p.medium;
  });

  router.get("/json/large", (ctx) => {
    ctx.body = p.large;
  });
};

export default json;
