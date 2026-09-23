import { getValidatedRouterParams } from "h3";
import { z } from "zod";

import type { Routes } from "../app.ts";

// rb:wiring parameters.*
/**
 * The captures as each route binds them. getValidatedRouterParams hands the route's params to a
 * zod schema, which converts each to an integer, and throws h3's validation error when one is not.
 */
const one = z.object({ one: z.coerce.number().int() });

const two = z.object({ one: z.coerce.number().int(), two: z.coerce.number().int() });
// rb:end

/**
 * parameters: router captures, each echoed back as the integer its schema converts it to. rou3 tries
 * a static segment before a capture, so the static path reaches its own route.
 */
const parameters: Routes = (app, p) => {
  app.get("/parameters/static/segment/literal", () => p.small);

  app.get("/parameters/:one/segment/literal", async (event) => ({ ...p.small, echo: await getValidatedRouterParams(event, one) }));

  app.get("/parameters/:one/with-second/:two", async (event) => ({ ...p.small, echo: await getValidatedRouterParams(event, two) }));
};

export default parameters;
