// rb:wiring forms.*
import formbody from "@fastify/formbody";
// rb:wiring forms.*
import multipart from "@fastify/multipart";

import type { Routes } from "../app.ts";
import { echoed, integer, string } from "../schemas.ts";
import { search, type Search } from "./query.ts";

/** What forms.multipart answers: the file's name and size, and the two fields beside it. */
const uploaded = {
  type: "object",
  properties: {
    file: { type: "object", properties: { name: string, bytes: integer } },
    echo: { type: "object", properties: { tenant: string, requestId: string } },
  },
} as const;

/**
 * forms: the same eight values query.many reads, from a urlencoded body, and an upload. The
 * urlencoded body is bound by query.many's schema, which ajv runs on the parsed form as it runs it
 * on a query string.
 */
const forms: Routes = async (app, { payloads: p }) => {
  // rb:wiring forms.*
  // A content-type parser each, registered in this family's plugin, so no other route accepts a form.
  await app.register(formbody);
  await app.register(multipart);
  // rb:end

  app.post<{ Body: Search }>("/forms/urlencoded", {
    schema: { body: search, response: { 200: echoed(search) } },
  }, async (request) => ({ ...p.small, echo: request.body }));

  app.post("/forms/multipart", { schema: { response: { 200: uploaded } } }, async (request) => {
    let file: { name: string; bytes: number } | undefined;
    const echo: Record<string, unknown> = {};
    // The parts in the order they arrived. A file part has to be read to its end before the next.
    for await (const part of request.parts()) {
      if (part.type === "file") file = { name: part.filename, bytes: (await part.toBuffer()).length };
      else echo[part.fieldname] = part.value;
    }
    return { file, echo };
  });
};

export default forms;
