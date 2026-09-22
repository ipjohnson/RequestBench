import { z } from "zod";
import { exceptions } from "@rb/tests/kit";

/**
 * What gin's README answers a failed bind with: 400, and the error's own text under `error`.
 * Gin writes no body of its own for one.
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
    "Gin writes nothing for a body it cannot bind, and its README answers one with 400 and " +
    "err.Error() under error, which is what these routes do. go-playground's validator writes " +
    "one line per rule a body breaks, naming the field by its json name. A body that is not JSON " +
    "gets the decoder's own message, which names no field. The router answers a path no route " +
    "matches, and a method the path has no route for, with the same 404.",
  rejected: 400,
  notFound: 404,
  wrongMethod: 404,
  envelope: Envelope,
  fields: (b) => broken(b).map((f) => f.field),
  message: (b, f) => broken(b).find((x) => x.field === f)?.line,
});
