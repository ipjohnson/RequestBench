// koa-parameter ships no types, and there is no @types package for it.
declare module "koa-parameter" {
  import type Koa from "koa";

  /**
   * Puts verifyParams on the application's context, and returns the middleware that answers the
   * error verifyParams throws: 422, with the failures as JSON.
   */
  export default function parameter(app: Koa): Koa.Middleware;
}
