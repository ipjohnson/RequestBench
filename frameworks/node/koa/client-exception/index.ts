import { z } from "zod";
import { exceptions } from "@rb/tests/kit";

/**
 * What koa-parameter's middleware writes when verifyParams throws: 422, the error's message, each
 * failure the parameter library reported, and the values it checked.
 */
const Envelope = z.object({
  message: z.string(),
  errors: z.array(z.object({ message: z.string(), code: z.string(), field: z.string() })),
  params: z.unknown(),
});

/** `lines[0].qty` -> `lines.0.qty` */
const fromField = (field: string) => field.replace(/\[(\d+)\]/g, ".$1");

export default exceptions({
  about:
    "koa-parameter's own answer to a body that breaks its rules: 422, and a JSON list of the " +
    "parameter library's failures, each naming its field. The validate routes check every rule, " +
    "and the first-error route checks one field at a time. Everything else is Koa's own error " +
    "handling, which writes the status message as text: the body parser's 400 for a body that is " +
    "not JSON, 404 for a path no route matches and for a missing row, and @koa/router's 405 for a " +
    "method the path has no route for.",
  rejected: 422,
  malformed: 400,
  notFound: 404,
  wrongMethod: 405,
  envelope: Envelope,
  fields: (b) => b.errors.map((e) => fromField(e.field)),
  message: (b, f) => b.errors.find((e) => fromField(e.field) === f)?.message,
});
