import { z } from "zod";
import { exceptions } from "@rb/tests/kit";

/**
 * Spring Boot's error page, which answers every refusal. With include-binding-errors set it lists
 * a refused body's field errors under errors, each with Spring's property path. Every answer also
 * carries a timestamp, which is not declared, so a captured body can leave it out.
 */
const Envelope = z.object({
  status: z.number(),
  error: z.string(),
  path: z.string(),
  errors: z.array(z.object({ field: z.string(), defaultMessage: z.string() })).optional(),
});

/** `lines[0].qty` -> `lines.0.qty` */
const fromPath = (path: string): string => path.replace(/\[(\d+)\]/g, ".$1");

export default exceptions({
  about:
    "Spring Boot's error page. Bean Validation's failures answer 400 and are listed under errors, " +
    "each named by its property path. A body Jackson cannot read never reaches the validator, and " +
    "answers 400 with no errors.",
  rejected: 400,
  malformed: 400,
  notFound: 404,
  wrongMethod: 405,
  envelope: Envelope,
  fields: (b) => (b.errors ?? []).map((e) => fromPath(e.field)),
  message: (b, f) => b.errors?.find((e) => fromPath(e.field) === f)?.defaultMessage,
});
