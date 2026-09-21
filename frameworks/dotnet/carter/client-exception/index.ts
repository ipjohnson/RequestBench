import { z } from "zod";
import { exceptions, fromClr, toClr } from "@rb/tests/kit";

const Envelope = z.object({
  title: z.string(),
  status: z.number(),
  errors: z.record(z.string(), z.array(z.string()).min(1)),
});

export default exceptions({
  about:
    "ProblemDetails, written by the FluentValidation filter. The keys are the " +
    "CLR property path, so PascalCase with a bracketed index, and each one " +
    "holds every message for that field.",
  rejected: 400,
  notFound: 404,
  wrongMethod: 405,
  envelope: Envelope,
  fields: (b) => Object.keys(b.errors).map(fromClr),
  message: (b, f) => b.errors[toClr(f)]?.[0],
});
