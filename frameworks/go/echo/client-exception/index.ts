import { z } from "zod";
import { exceptions } from "@rb/tests/kit";

/**
 * What Echo's default error handler writes for an error a handler returns: `message`, which is
 * an HTTPError's own message, or the status text for any other error.
 */
const Envelope = z.object({ message: z.string() });

/**
 * One line of go-playground's text per rule a body breaks. The key is the struct's Go name and
 * then each field's json name, which the validator is set to use:
 * `Key: 'CheckedOrder.lines[0].qty' Error:Field validation for 'qty' failed on the 'gt' tag`
 */
const BROKEN = /^Key: '[^.']+\.([^']+)' Error:Field validation for '[^']*' failed on the '[^']+' tag$/;

/** `lines[0].qty` -> `lines.0.qty` */
const fromNamespace = (namespace: string) => namespace.replace(/\[(\d+)\]/g, ".$1");

const broken = (body: { message: string }) =>
  body.message.split("\n").flatMap((line) => {
    const m = BROKEN.exec(line);
    return m ? [{ field: fromNamespace(m[1]!), line }] : [];
  });

export default exceptions({
  about:
    "Echo returns every failure to its default error handler, which writes the error's message " +
    "under message. The validator registered as e.Validator refuses a body with an HTTPError " +
    "carrying go-playground's text, one line per rule the body breaks, naming the field by its " +
    "json name. A body the binder cannot decode is echo.ErrBadRequest wrapping the decoder's " +
    "error, which the handler writes as Bad Request and which names no field. The router " +
    "answers a path no route matches with 404, and a method the path has no route for with 405.",
  rejected: 400,
  notFound: 404,
  wrongMethod: 405,
  envelope: Envelope,
  fields: (b) => broken(b).map((f) => f.field),
  message: (b, f) => broken(b).find((x) => x.field === f)?.line,
});
