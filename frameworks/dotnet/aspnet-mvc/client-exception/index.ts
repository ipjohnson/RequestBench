import { z } from "zod";
import { exceptions, fromClr } from "@rb/tests/kit";

/**
 * ASP.NET Core's ProblemDetails, which MVC answers every refusal with. [ApiController]'s
 * automatic 400 is a ValidationProblemDetails, whose errors map each ModelState key to its
 * messages.
 */
const Envelope = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number(),
  errors: z.record(z.string(), z.array(z.string())).optional(),
});

export default exceptions({
  about:
    "ASP.NET Core's ProblemDetails. [ApiController] refuses a body that breaks the order's " +
    "DataAnnotations with 400 and maps each failed property, named by its CLR path, to its " +
    "messages under errors. A body that is not JSON is the same 400, with errors keyed by the " +
    "JSON path where reading stopped and by the parameter the body could not fill.",
  rejected: 400,
  notFound: 404,
  wrongMethod: 405,
  envelope: Envelope,
  fields: (b) => Object.keys(b.errors ?? {}).map(fromClr),
  message: (b, f) => Object.entries(b.errors ?? {}).find(([k]) => fromClr(k) === f)?.[1][0],
});
