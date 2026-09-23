import { bodyParser } from "@koa/bodyparser";
// rb:wiring forms.*
import multer from "@koa/multer";

import type { Routes } from "../app.ts";
import { search } from "./query.ts";

/**
 * forms: the same eight values query.many reads, from a urlencoded body, and an upload. The
 * urlencoded values are converted as the query route converts them.
 */
const forms: Routes = (router, { payloads: p }) => {
  // rb:wiring forms.*
  // Route middleware each, so no other route reads a form. @koa/bodyparser reads the urlencoded
  // body. @koa/multer is the Koa organisation's wrapper of Express's multer, which reads the upload
  // and keeps the file in memory, its default when given no destination.
  const form = bodyParser({ enableTypes: ["form"] });
  const upload = multer().single("file");
  // rb:end

  router.post("/forms/urlencoded", form, (ctx) => {
    ctx.body = { ...p.small, echo: search(ctx.request.body as Record<string, string>) };
  });

  router.post("/forms/multipart", upload, (ctx) => {
    ctx.body = { file: { name: ctx.file.originalname, bytes: ctx.file.size }, echo: ctx.request.body };
  });
};

export default forms;
