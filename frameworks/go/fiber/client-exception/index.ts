import { z } from "zod";
import { exceptions } from "@rb/tests/kit";

/**
 * What step 4 of Fiber's validation guide answers a failed validation with: 400, and one entry
 * per rule broken, holding go-playground's `Field()` and `Tag()`. The validator is set to name a
 * field by its json name. `Field()` is the field's own name without the path to it, so a line's
 * `qty` is named `qty`, not `lines.0.qty`.
 */
const Envelope = z.object({
  errors: z.array(z.object({ field: z.string(), rule: z.string() })),
});

export default exceptions({
  about:
    "Fiber binds and validates in one call, c.Bind().Body, which runs the go-playground adapter " +
    "the app registers as its StructValidator. A validation failure is answered as step 4 of " +
    "Fiber's validation guide answers one: 400, with the field and the rule of each error. Any " +
    "other bind failure is returned to Fiber's default error handler, as the guide returns it. A " +
    "body that is not JSON is a BindError, which carries no status, so the handler answers it " +
    "with 500 and the error's text as text/plain. The router answers a path no route matches " +
    "with 404, and a method the path has no route for with 405.",
  rejected: 400,
  malformed: 500,
  notFound: 404,
  wrongMethod: 405,
  envelope: Envelope,
  fields: (b) => b.errors.map((e) => e.field),
  message: (b, f) => b.errors.find((e) => e.field === f)?.rule,
});
