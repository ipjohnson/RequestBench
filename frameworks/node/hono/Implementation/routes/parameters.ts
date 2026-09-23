import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import type { Routes } from "../app.ts";

// rb:wiring parameters.*
/**
 * The captures as each route binds them. zValidator's param target hands zod the route's captures,
 * which are strings, and zod converts each to an integer, so the handler reads numbers.
 */
const one = z.object({ one: z.coerce.number().int() });

const two = z.object({ one: z.coerce.number().int(), two: z.coerce.number().int() });
// rb:end

/**
 * parameters: router captures, each echoed back as the integer its schema converts it to. The
 * static path is registered first, because it also matches the one-capture route, and Hono runs
 * the handlers that match a path in the order they were registered.
 */
const parameters: Routes = (app, p) => {
  app.get("/parameters/static/segment/literal", (c) => c.json(p.small));

  app.get("/parameters/:one/segment/literal", zValidator("param", one), (c) => c.json({ ...p.small, echo: c.req.valid("param") }));

  app.get("/parameters/:one/with-second/:two", zValidator("param", two), (c) => c.json({ ...p.small, echo: c.req.valid("param") }));
};

export default parameters;
