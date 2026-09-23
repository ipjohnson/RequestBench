import { handleCors, type CorsOptions, type HTTPMethod } from "h3";

import type { Routes } from "../app.ts";
import { fresh } from "../serial.ts";

/**
 * cors: h3's handleCors, called by the route's handler, which is how h3's CORS guide wires it.
 * handleCors answers a preflight with 204 itself, and adds its headers to any other request, which
 * the handler then answers. The route takes every method, so a preflight reaches it. The handler
 * writes x-rb-serial only after handleCors has let the request through, so its absence on a
 * preflight shows handleCors answered alone.
 */
const cors: Routes = (app, p) => {
  const { origin, method, header, maxAgeSeconds } = p.settings.cors;

  // rb:wiring cors.*
  // The origin as a list of one, which handleCors checks the request's origin against, adding
  // Vary: Origin.
  const options: CorsOptions = { origin: [origin], methods: [method as HTTPMethod], allowHeaders: [header], maxAge: String(maxAgeSeconds) };

  // rb:handler cors.request,cors.preflight
  app.all("/cors/small", (event) => {
    // rb:wiring cors.*
    const preflight = handleCors(event, options);
    if (preflight !== false) return preflight;
    return fresh(event, p.small);
  });
};

export default cors;
