import { readBody, readValidatedBody } from "h3";

import type { Routes } from "../app.ts";
import { search } from "./query.ts";

/** The parts forms.multipart sends, as readBody collects them. */
interface Upload {
  readonly tenant: string;
  readonly requestId: string;
  readonly file: File;
}

/**
 * forms: the same eight values query.many reads, from a urlencoded body, and an upload. readBody
 * parses a urlencoded body by its content type, and readValidatedBody hands it to query.many's
 * schema, which converts the numbers as it does for a query string. A multipart body has to be
 * asked for, and readBody reads it through the request's formData().
 */
const forms: Routes = (app, p) => {
  app.post("/forms/urlencoded", async (event) => ({ ...p.small, echo: await readValidatedBody(event, search) }));

  app.post("/forms/multipart", async (event) => {
    const { tenant, requestId, file } = (await readBody<Upload>(event, { type: "formData" }))!;
    return { file: { name: file.name, bytes: file.size }, echo: { tenant, requestId } };
  });
};

export default forms;
