import express from "express";
// rb:wiring forms.*
import multer from "multer";

import type { Routes } from "../app.ts";
import { search } from "./query.ts";

/**
 * forms: the same eight values query.many reads, from a urlencoded body, and an upload.
 * express.urlencoded parses the form into strings, which query.many's conversion binds. multer, the
 * expressjs middleware for multipart bodies, reads the upload into memory.
 */
const forms: Routes = (app, p) => {
  // rb:wiring forms.*
  // Each parser is in its own route's handler list, so no other route reads a form.
  const form = express.urlencoded();
  const upload = multer().single("file");
  // rb:end

  app.post("/forms/urlencoded", form, (request, response) => response.json({ ...p.small, echo: search(request.body) }));

  app.post("/forms/multipart", upload, (request, response) => response.json({
    file: { name: request.file?.originalname, bytes: request.file?.size },
    echo: { tenant: request.body.tenant, requestId: request.body.requestId },
  }));
};

export default forms;
