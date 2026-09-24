import { z } from "zod";
import { exceptions, field } from "@rb/tests/kit";

/**
 * Hardened's validation refusal, which answers a body that breaks a constraint and a body that
 * does not parse alike: a ValidationError with one entry per failed rule under errors.
 */
const Envelope = z.object({
  type: z.literal("ValidationError"),
  message: z.string(),
  errors: z.array(z.object({ field: z.string(), code: z.string(), message: z.string() })).min(1),
});

/** `order.lines[0].qty` -> `lines.0.qty`: the path after the body parameter's name. */
const fromBody = (name: string): string => field(...name.replace(/\[(\d+)\]/g, ".$1").split(".").slice(1));

export default exceptions({
  about:
    "Hardened's ValidationError, 400, with each failed rule under errors. Each field is the body " +
    "parameter's name, a dot and the path to the member, such as order.lines[0].qty. A body that " +
    "is not JSON gets the same body and status, with one entry naming the body parameter. The " +
    "router answers a path no route matches with a 404 and a method the path has no route for " +
    "with a 405, both with no body.",
  rejected: 400,
  notFound: 404,
  wrongMethod: 405,
  envelope: Envelope,
  fields: (b) => b.errors.map((e) => fromBody(e.field)),
  message: (b, f) => b.errors.find((e) => fromBody(e.field) === f)?.message,
});
