import { z } from "zod";
import { exceptions, field } from "@rb/tests/kit";

/** One of express-validator's field errors, as result.array() lists it. */
const FieldError = z.object({
  type: z.literal("field"),
  value: z.unknown(),
  msg: z.string(),
  path: z.string(),
  location: z.string(),
});

const Envelope = z.object({ errors: z.array(FieldError) });

/** `lines[0].qty` -> `lines.0.qty` */
const normal = (path: string): string => field(...path.replace(/\[(\d+)\]/g, ".$1").split("."));

export default exceptions({
  about:
    "Express has no validation of its own, and its documentation names no " +
    "library for it. express-validator refuses a body with result.array(), " +
    "which the route writes as { errors } with 400, as express-validator's " +
    "guide does. Each error names its field by path, with a list index in " +
    "brackets. The validate routes run every chain, so a body with three bad " +
    "fields names three, and the first-error route runs them one at a time " +
    "and names the first. Express's final handler answers a body that is not " +
    "JSON with 400 and an HTML page, and a path or a method with no route " +
    "with 404.",
  rejected: 400,
  notFound: 404,
  wrongMethod: 404,
  reports: "all",
  envelope: Envelope,
  fields: (b) => [...new Set(b.errors.map((e) => normal(e.path)))],
  message: (b, f) => b.errors.find((e) => normal(e.path) === f)?.msg,
});
