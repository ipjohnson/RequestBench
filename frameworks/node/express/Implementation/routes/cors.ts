// rb:wiring cors.*
import cors from "cors";

import type { Routes } from "../app.ts";
import { serial } from "../serial.ts";

/**
 * cors: cors, the expressjs middleware, in the handler lists of the two /cors/small routes, as its
 * README enables a preflight for one route. On the OPTIONS route it answers the preflight and ends
 * the response, and on the GET route it adds its headers and hands the request to the handler. The
 * handler writes x-rb-serial, so its absence on a preflight shows the middleware answered alone.
 */
const corsRoutes: Routes = (app, p) => {
  const { origin, method, header, maxAgeSeconds } = p.settings.cors;

  // rb:wiring cors.*
  // The origin as a list of one. Given a string, the middleware writes it on every answer, whichever
  // origin asked. Given a list, it checks the request's origin, and adds Vary: Origin either way.
  const policy = cors({ origin: [origin], methods: [method], allowedHeaders: [header], maxAge: maxAgeSeconds });

  // rb:handler cors.preflight,cors.disallowed
  app.options("/cors/small", policy);

  // rb:handler cors.request,cors.vary
  app.get("/cors/small", policy, (_request, response) => serial(response).json(p.small));
};

export default corsRoutes;
