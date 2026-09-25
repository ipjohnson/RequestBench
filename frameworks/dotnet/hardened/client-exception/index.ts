import { z } from "zod";
import { exceptions, fromClr } from "@rb/tests/kit";

/**
 * Hardened's validation refusal, which a failed constraint and a body the binder cannot read both
 * answer with. Each error names its field as the body parameter's name, a dot, and the member's
 * path, with a list index in brackets: order.lines[0].qty.
 */
const Envelope = z.object({
  type: z.string(),
  message: z.string(),
  errors: z.array(z.object({ field: z.string(), code: z.string(), message: z.string() })),
});

/** `order.lines[0].qty` -> `lines.0.qty`: the path inside the body, without the parameter's name. */
const inBody = (field: string): string => fromClr(field).split(".").slice(1).join(".");

export default exceptions({
  about:
    "Hardened's validation error body. A failed constraint answers 400 and lists each failed rule " +
    "under errors, named by the body parameter and the member's path. A body that is not JSON is " +
    "refused by the binder with the same 400, naming the body parameter with the code invalid. A " +
    "path with no route answers 404, and a method the path lacks 405, both with no body.",
  rejected: 400,
  malformed: 400,
  notFound: 404,
  wrongMethod: 405,
  envelope: Envelope,
  fields: (b) => b.errors.map((e) => inBody(e.field)),
  message: (b, f) => b.errors.find((e) => inBody(e.field) === f)?.message,
});
