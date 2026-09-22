import { z } from "zod";
import { exceptions, fromClr } from "@rb/tests/kit";

/**
 * ASP.NET Core's ProblemDetails, which Wolverine writes for the two refusals that carry a body.
 * Wolverine's FluentValidation middleware adds errors, each failed property's messages keyed by
 * its CLR property path.
 */
const Envelope = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number(),
  errors: z.record(z.string(), z.array(z.string())).optional(),
});

export default exceptions({
  about:
    "ASP.NET Core's ProblemDetails, as Wolverine writes it. Wolverine's FluentValidation middleware " +
    "answers 400 and keys each failed property's messages under errors by its CLR property path. A body " +
    "that is not JSON never reaches the validator: Wolverine answers it with a 400 titled Invalid JSON " +
    "format that names no field. A missing row, an unmatched path, a method the path lacks and a " +
    "forbidden token are answered with no body.",
  rejected: 400,
  malformed: 400,
  notFound: 404,
  wrongMethod: 405,
  envelope: Envelope,
  fields: (b) => Object.keys(b.errors ?? {}).map(fromClr),
  message: (b, f) => Object.entries(b.errors ?? {}).find(([k]) => fromClr(k) === f)?.[1][0],
});
