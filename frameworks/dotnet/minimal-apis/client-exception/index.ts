import { z } from "zod";
import { exceptions, fromClr } from "@rb/tests/kit";

/**
 * ASP.NET Core's ProblemDetails, which minimal APIs answer every refusal with. A failed validation
 * is an HttpValidationProblemDetails, which adds errors: each failed field's CLR property path
 * mapped to its messages.
 */
const Envelope = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number(),
  errors: z.record(z.string(), z.array(z.string())).optional(),
});

export default exceptions({
  about:
    "ASP.NET Core's ProblemDetails. Minimal APIs' validation answers 400 and maps each failed " +
    "field's CLR property path, such as Lines[0].Qty, to its messages under errors. A body that is " +
    "not JSON never reaches validation, and the binder refuses it with a 400 that names no field.",
  rejected: 400,
  malformed: 400,
  notFound: 404,
  wrongMethod: 405,
  envelope: Envelope,
  fields: (b) => Object.keys(b.errors ?? {}).map(fromClr),
  message: (b, f) => Object.entries(b.errors ?? {}).find(([k]) => fromClr(k) === f)?.[1][0],
});
