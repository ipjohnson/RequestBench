import type { Routes } from "../app.ts";

/** baseline: the dispatch floor, with nothing serialised. Koa sends a string that does not start with `<` as text/plain. */
const baseline: Routes = (router) => {
  router.get("/plaintext", (ctx) => {
    ctx.body = "Hello, World!";
  });
};

export default baseline;
