import { z } from "zod";
import { exceptions } from "@rb/tests/kit";

/**
 * The refusal these routes write with encoding/json's encoder, because mux has none of its own:
 * the error's own text under `error`.
 */
const Envelope = z.object({ error: z.string() });

/**
 * One line of go-playground's text per rule a body breaks. The key is the struct's Go name and
 * then each field's json name, which the validator is set to use:
 * `Key: 'CheckedOrder.lines[0].qty' Error:Field validation for 'qty' failed on the 'gt' tag`
 */
const BROKEN = /^Key: '[^.']+\.([^']+)' Error:Field validation for '[^']*' failed on the '[^']+' tag$/;

/** `lines[0].qty` -> `lines.0.qty` */
const fromNamespace = (namespace: string) => namespace.replace(/\[(\d+)\]/g, ".$1");

const broken = (body: { error: string }) =>
  body.error.split("\n").flatMap((line) => {
    const m = BROKEN.exec(line);
    return m ? [{ field: fromNamespace(m[1]!), line }] : [];
  });

export default exceptions({
  about:
    "mux binds nothing and writes no refusal of its own. The routes decode with encoding/json, " +
    "check with go-playground's validator, and answer a failure with 400 and the error's text " +
    "under error, written with encoding/json's encoder. The validator writes one line per rule a " +
    "body breaks, naming the field by its json name. A body that is not JSON gets the decoder's " +
    "own message, which names no field. The router answers a path no route matches with " +
    "net/http's 404 text, and a method the path has no route for with 405 and nothing else.",
  rejected: 400,
  notFound: 404,
  wrongMethod: 405,
  envelope: Envelope,
  fields: (b) => broken(b).map((f) => f.field),
  message: (b, f) => broken(b).find((x) => x.field === f)?.line,
});
