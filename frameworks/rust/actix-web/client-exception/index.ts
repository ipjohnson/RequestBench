import { z } from "zod";
import { exceptions, field } from "@rb/tests/kit";

/** One rule a value broke, as the validator crate writes it. */
const Broken = z.object({
  code: z.string(),
  message: z.string().nullable(),
  params: z.record(z.string(), z.unknown()),
});

type Broken = z.infer<typeof Broken>;

/**
 * validator's ValidationErrors. A field holds the rules its value broke, or, for a nested struct,
 * that struct's errors, or, for a list, the errors of each entry by its index.
 */
interface Errors {
  readonly [name: string]: readonly Broken[] | Errors;
}

const Envelope: z.ZodType<Errors> = z.lazy(() => z.record(z.string(), z.union([z.array(Broken).min(1), Envelope])));

/** `customer_id` -> `customerId`. validator names a field as the Rust struct does, and serde renames it on the wire. */
const wire = (name: string): string => name.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

const isRules = (value: readonly Broken[] | Errors): value is readonly Broken[] => Array.isArray(value);

/** Every field that broke a rule, in the corpus's spelling, with the rules it broke. */
function broke(errors: Errors, at: readonly string[] = []): [string, readonly Broken[]][] {
  return Object.entries(errors).flatMap(([name, value]): [string, readonly Broken[]][] => {
    const path = [...at, wire(name)];
    return isRules(value) ? [[field(...path), value]] : broke(value, path);
  });
}

export default exceptions({
  about:
    "An extractor written in the port runs the validator crate's rules before the handler, because " +
    "actix-web has no validation of its own. It answers a broken rule with 400 and validator's " +
    "ValidationErrors as JSON. A field is keyed by its Rust name, which serde writes in camelCase on " +
    "the wire, and a nested struct or a list entry by its index holds errors of its own. A body that is not " +
    "JSON never reaches the rules: the extractor refuses it with a 400 whose body is text. The " +
    "router answers a path with no route with 404, and a method the resource has no route for with " +
    "405, both with no body.",
  rejected: 400,
  malformed: 400,
  notFound: 404,
  wrongMethod: 405,
  envelope: Envelope,
  fields: (b) => broke(b).map(([f]) => f),
  message: (b, f) => {
    const rule = broke(b).find(([name]) => name === f)?.[1][0];
    return rule === undefined ? undefined : (rule.message ?? rule.code);
  },
});
