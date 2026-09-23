import { z } from "zod";
import { exceptions, field } from "@rb/tests/kit";

/** The ErrorMessage of warp's rejections example, which the application's recover handler writes. */
const Envelope = z.object({ code: z.number().int(), message: z.string() });

/**
 * One field's entry in validator's report of a struct, which is the message: the field's path as
 * the Rust struct names it, such as `customer_id` or `lines[0].qty`, then its first broken rule:
 * `customer_id: Validation error: range [{"min": Number(1), "value": Number(0)}]`. A top-level
 * field's entry ends with a line break, and the entries inside a list run on with none between
 * them, so an entry starts at the message's start, after a line break, or after the `]` that
 * closed the entry before it.
 */
const ENTRY = /(?:^|\n|\])([a-z_][a-z0-9_]*(?:\[\d+\])?(?:\.[a-z_][a-z0-9_]*(?:\[\d+\])?)*): Validation error: ([a-z_]+) /g;

/** `lines[0].product_id` -> `lines.0.productId`. validator names a field as the Rust struct does, and serde renames it on the wire. */
const wire = (path: string): string =>
  field(...path.replace(/\[(\d+)\]/g, ".$1").split(".").map((segment) => segment.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())));

/** Every field the message names, in the corpus's spelling, with the code of the rule it broke. */
const broken = (b: { message: string }): [string, string][] => [...b.message.matchAll(ENTRY)].map((m) => [wire(m[1]!), m[2]!]);

export default exceptions({
  about:
    "warp answers a rejection nothing recovers with text, so the validation refusal follows warp's " +
    "rejections example: the validate routes reject with a rejection of the application's own, and its " +
    "recover handler answers 400 with the example's ErrorMessage, {code, message}, the message being " +
    "validator's report of every rule the body broke, one field per line by its Rust name. A body " +
    "that is not JSON never reaches the rules: warp's json body filter refuses it with 400 as text. " +
    "A path no route matches is warp's 404 with no body, and a method the path has no route for is " +
    "warp's 405 as text.",
  rejected: 400,
  malformed: 400,
  notFound: 404,
  wrongMethod: 405,
  envelope: Envelope,
  fields: (b) => broken(b).map(([f]) => f),
  message: (b, f) => broken(b).find(([name]) => name === f)?.[1],
});
