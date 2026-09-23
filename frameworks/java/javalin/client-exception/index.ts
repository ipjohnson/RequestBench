import { z } from "zod";
import { exceptions } from "@rb/tests/kit";

/**
 * The body Javalin writes for a ValidationException: each field a check failed on, with the check's
 * message and the value it saw. The routes file each check under the corpus's name for its field.
 * A body the JSON mapper cannot read is filed under REQUEST_BODY as DESERIALIZATION_FAILED.
 */
const Envelope = z.record(
  z.string(),
  z.array(z.object({ message: z.string(), args: z.record(z.string(), z.unknown()), value: z.unknown() })).min(1),
);

export default exceptions({
  about:
    "Javalin's own answer to a ValidationException: 400, and a JSON object keyed by the field each " +
    "failed check is filed under, with the check's message. ctx.bodyValidator runs every check, and " +
    "the first-error route checks one field at a time with Javalin's Validator. A body that is not " +
    "JSON fails the same way under REQUEST_BODY and names no field of the order. The router answers " +
    "a path no route matches, and a method the path has no route for, with the same 404 as text.",
  rejected: 400,
  notFound: 404,
  wrongMethod: 404,
  envelope: Envelope,
  fields: (b) => Object.keys(b),
  message: (b, f) => b[f]?.[0]?.message,
});
