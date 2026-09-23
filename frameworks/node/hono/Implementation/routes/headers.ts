import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import type { Routes } from "../app.ts";

// rb:wiring headers.*
/**
 * The three headers the route binds. zValidator's header target hands zod every request header,
 * and zod keeps the three the schema names and converts x-rb-account to an integer.
 */
const bound = z.object({
  "x-rb-tenant": z.string(),
  "x-rb-request-id": z.string(),
  "x-rb-account": z.coerce.number().int(),
});
// rb:end

/** headers: /headers reads no header, and /headers/bind binds three through zValidator. */
const headers: Routes = (app, p) => {
  app.get("/headers", (c) => c.json(p.small));

  app.get("/headers/bind", zValidator("header", bound), (c) => {
    const h = c.req.valid("header");
    return c.json({ ...p.small, echo: { tenant: h["x-rb-tenant"], requestId: h["x-rb-request-id"], account: h["x-rb-account"] } });
  });
};

export default headers;
