import { zValidator } from "@hono/zod-validator";

import type { Routes } from "../app.ts";
import { search } from "./query.ts";

/**
 * forms: the same eight values query.many reads, from a urlencoded body, and an upload. The
 * urlencoded body is bound by query.many's schema through zValidator's form target, and the upload
 * is read by c.req.parseBody(), as Hono's file upload example reads one.
 */
const forms: Routes = (app, p) => {
  // rb:wiring forms.*
  app.post("/forms/urlencoded", zValidator("form", search), (c) => c.json({ ...p.small, echo: c.req.valid("form") }));

  app.post("/forms/multipart", async (c) => {
    // parseBody reads the whole body before it returns, so the file part is complete here.
    const form = await c.req.parseBody();
    const file = form["file"] as File;
    return c.json({ file: { name: file.name, bytes: file.size }, echo: { tenant: form["tenant"], requestId: form["requestId"] } });
  });
};

export default forms;
