// rb:wiring cors.*
import cors from "@koa/cors";

import type { Routes } from "../app.ts";
import { fresh } from "../serial.ts";

/**
 * cors: @koa/cors as route middleware on /cors/small. It answers a preflight itself, and adds its
 * headers to the request that follows. The handler writes x-rb-serial, so its absence on a
 * preflight shows the middleware answered alone.
 */
const corsFamily: Routes = (router, { payloads: p }) => {
  const origin = "https://shop.example.com";

  // rb:wiring cors.*
  // The origin as a function that names the allowed origin only when the request comes from
  // it. Given a string, @koa/cors writes that origin on every answer whichever origin asked, and
  // given a function that returns nothing, it adds no headers and passes the request on.
  const allowed = cors({ origin: (ctx) => (ctx.get("origin") === origin ? origin : ""), allowMethods: ["GET"], allowHeaders: ["x-rb-tenant"], maxAge: 600 });

  // @koa/router runs a route's middleware only for a method the route has, so the preflight has a
  // route of its own, which @koa/cors answers alone.
  // rb:handler cors.preflight
  router.options("/cors/small", allowed);

  // rb:handler cors.request,cors.vary
  router.get("/cors/small", allowed, (ctx) => fresh(ctx, p.small));
};

export default corsFamily;
