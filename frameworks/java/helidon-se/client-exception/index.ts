import { z } from "zod";
import { exceptions, field } from "@rb/tests/kit";

/**
 * What the routing's error handler answers a ValidationException with: the exception's own
 * message under error, as Helidon's SE quickstart answers a body it refuses. Helidon writes no
 * JSON of its own for one.
 */
const Envelope = z.object({ error: z.string() });

/**
 * One violation in Helidon Validation's message, which lists each as its message, " at ", and the
 * path it recorded:
 * `Constraint validation failed: 0 is not positive at TYPE(implementation.OrderRequest)/RECORD_COMPONENT(customerId), is empty at ...`
 */
const VIOLATION = /(?:: |, )(.+?) at ((?:[A-Z_]+\([^)]*\)\/)*[A-Z_]+\([^)]*\))(?=, |$)/g;

/**
 * `TYPE(implementation.OrderRequest)/RECORD_COMPONENT(lines)/ELEMENT(element)/TYPE(...)/RECORD_COMPONENT(qty)` -> `lines.qty`.
 * A list entry's path records no index, so none is given.
 */
const fromPath = (path: string): string => field(...[...path.matchAll(/RECORD_COMPONENT\((\w+)\)/g)].map((m) => m[1]!));

const violations = (b: { error: string }) =>
  [...b.error.matchAll(VIOLATION)].map((m) => ({ field: fromPath(m[2]!), message: m[1]! }));

export default exceptions({
  about:
    "Helidon SE writes no JSON for a refused body. The routing's error handler answers Helidon " +
    "Validation's ValidationException with 400 and the exception's message under error, which " +
    "lists each violation with the path Helidon recorded for it, a record component by its name " +
    "and a list entry without its index. A body Helidon JSON Binding cannot read is refused by " +
    "the media support with 400 and text/plain, before validation. The router answers a path no " +
    "route matches, and a method the path has no route for, with the same 404 as text/plain.",
  rejected: 400,
  malformed: 400,
  notFound: 404,
  wrongMethod: 404,
  envelope: Envelope,
  fields: (b) => violations(b).map((v) => v.field),
  message: (b, f) => violations(b).find((v) => v.field === f)?.message,
});
