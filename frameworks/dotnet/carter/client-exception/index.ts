import { z } from "zod";
import { exceptions, fromClr } from "@rb/tests/kit";

/**
 * ASP.NET Core's ProblemDetails, which Carter answers every refusal with. Carter's
 * validation filter adds errors, one entry per failed rule.
 */
const Envelope = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number(),
  errors: z.array(z.object({ propertyName: z.string(), errorMessage: z.string() })).optional(),
});

export default exceptions({
  about:
    "ASP.NET Core's ProblemDetails. Carter's validation filter answers 422 and lists each failed " +
    "rule under errors, named by its CLR property path. A body that is not JSON never reaches the " +
    "filter, and the binder refuses it with a 400 that names no field.",
  rejected: 422,
  malformed: 400,
  notFound: 404,
  wrongMethod: 405,
  envelope: Envelope,
  fields: (b) => (b.errors ?? []).map((e) => fromClr(e.propertyName)),
  message: (b, f) => b.errors?.find((e) => fromClr(e.propertyName) === f)?.errorMessage,
});
