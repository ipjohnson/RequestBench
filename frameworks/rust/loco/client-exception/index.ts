import { z } from "zod";
import { exceptions, field } from "@rb/tests/kit";

/** One rule a value broke, as Loco writes the validator crate's error. */
const Broken = z.object({
  code: z.string(),
  message: z.string().nullable(),
  params: z.record(z.string(), z.unknown()).optional(),
});

/** Loco's refusal of a body that breaks its rules: the rules each field broke, by the field's Rust name. */
const Envelope = z.object({ errors: z.record(z.string(), z.array(Broken).min(1)) });

/** `customer_id` -> `customerId`. validator names a field as the Rust struct does, and serde renames it on the wire. */
const wire = (name: string): string => field(name.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase()));

export default exceptions({
  about:
    "Loco's JsonValidateWithMessage runs the validator crate's rules before the handler and " +
    "refuses the body with 400 and { errors }, the rules each field broke, keyed by the field's " +
    "Rust name, which serde writes in camelCase on the wire. Loco keeps only the fields of the " +
    "struct itself, so a rule a line breaks names no field. The first-error route checks one " +
    "field at a time and refuses the same way at the first. A body that is not JSON is Loco's Json " +
    "rejection, 400 with { error } and no field. axum's router answers a path with no route with " +
    "404 and a method a path has no route for with 405.",
  rejected: 400,
  malformed: 400,
  notFound: 404,
  wrongMethod: 405,
  reports: "all",
  envelope: Envelope,
  fields: (b) => Object.keys(b.errors).map(wire),
  message: (b, f) => {
    const rule = Object.entries(b.errors).find(([name]) => wire(name) === f)?.[1][0];
    return rule === undefined ? undefined : (rule.message ?? rule.code);
  },
});
