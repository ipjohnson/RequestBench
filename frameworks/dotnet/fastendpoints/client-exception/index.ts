import { z } from "zod";
import { exceptions, fromClr } from "@rb/tests/kit";

/**
 * FastEndpoints' ErrorResponse, which it answers a failed validator and an unreadable body
 * with. errors keys each failure by its property path, named by the serializer's naming policy.
 */
const Envelope = z.object({
  statusCode: z.number(),
  message: z.string(),
  errors: z.record(z.string(), z.array(z.string())),
});

export default exceptions({
  about:
    "FastEndpoints' ErrorResponse. A failed Validator answers 400 and lists each failed rule " +
    "under errors, keyed by its camel-case property path. A body the serializer cannot read " +
    "never reaches the validator, and FastEndpoints answers it with the same 400 and envelope, " +
    "keyed by the JSON path where reading stopped. A missing row, a path no route matches and a " +
    "method the path has no route for are answered with no body.",
  rejected: 400,
  malformed: 400,
  notFound: 404,
  wrongMethod: 405,
  envelope: Envelope,
  fields: (b) => Object.keys(b.errors).map(fromClr),
  message: (b, f) => Object.entries(b.errors).find(([k]) => fromClr(k) === f)?.[1][0],
});
