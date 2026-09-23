import { z } from "zod";
import { exceptions, field } from "@rb/tests/kit";

/**
 * Pydantic's own list of failures, which SpecTree answers as the whole body. Each entry also
 * carries the rejected `input` and a `url` to Pydantic's page for the error type.
 */
const Envelope = z.array(
  z.object({
    type: z.string(),
    loc: z.array(z.union([z.string(), z.number()])),
    msg: z.string(),
  }),
).min(1);

export default exceptions({
  about:
    "Starlette validates nothing itself. SpecTree validates the body against a Pydantic model and " +
    "answers a failure with 422 and Pydantic's list of failures as the whole body. loc starts at " +
    "the field, with no source in front of it, and a list index arrives as a number. A body that " +
    "is not JSON is SpecTree's 422 too, as {\"error_msg\": ...} naming no field. Starlette's router " +
    "answers a path no route matches with a 404 and HTTPEndpoint a method it has no function for " +
    "with a 405, both as text.",
  rejected: 422,
  notFound: 404,
  wrongMethod: 405,
  envelope: Envelope,
  fields: (b) => b.map((d) => field(...d.loc)),
  message: (b, f) => b.find((d) => field(...d.loc) === f)?.msg,
});
