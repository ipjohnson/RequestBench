import { z } from "zod";
import { exceptions } from "@rb/tests/kit";

/**
 * Micronaut's default error body: the status's reason under message, a link to the request's
 * path, and one entry per error under _embedded.errors. Micronaut Serialization lists the errors
 * even when there is one.
 */
const Envelope = z.object({
  message: z.string(),
  _links: z.object({ self: z.array(z.object({ href: z.string(), templated: z.boolean() })) }).optional(),
  _embedded: z.object({ errors: z.array(z.object({ message: z.string(), path: z.string().optional() })) }),
});

/**
 * One error per rule a body breaks: the property path from the handler's parameter, a colon and
 * the rule's message, as in `order.lines[0].qty: must be greater than 0`.
 */
const BROKEN = /^[^.:\s]+\.([^:\s]+): (.*)$/s;

/** `lines[0].qty` -> `lines.0.qty` */
const fromPath = (path: string) => path.replace(/\[(\d+)\]/g, ".$1");

const broken = (body: z.infer<typeof Envelope>) =>
  body._embedded.errors.flatMap((e) => {
    const m = BROKEN.exec(e.message);
    return m ? [{ field: fromPath(m[1]!), message: m[2]! }] : [];
  });

export default exceptions({
  about:
    "Micronaut's default error body, with each error under _embedded.errors. micronaut-validation " +
    "refuses a body with 400 and one error per rule it breaks, whose message leads with the " +
    "property path from the handler's parameter. A body the parser cannot read is refused with 400 " +
    "and one error that names the parameter and no property. The router answers a path no route " +
    "matches with 404 and a method the path has no route for with 405.",
  rejected: 400,
  malformed: 400,
  notFound: 404,
  wrongMethod: 405,
  envelope: Envelope,
  fields: (b) => broken(b).map((e) => e.field),
  message: (b, f) => broken(b).find((e) => e.field === f)?.message,
});
