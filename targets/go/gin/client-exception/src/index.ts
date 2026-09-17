// go:gin's error contract.
//
// Two layers, two statuses, which is why the rejection endpoints declare both. Gin binds with ShouldBindJSON and validates through the go-playground validator it holds in binding.Validator, reading the rules from the binding: tag.
// A body the decoder could not turn into the struct never reaches the validator, so it names
// no field and answers 400. A body that became the struct and then failed a rule answers 422
// with the fields go-playground refused.
//
// spec/plan.json sends {"customer_id": "not-an-int", ...} to the rejection endpoints, which
// is a type mismatch, so today they answer the 400 branch and the validator is exercised by
// the valid bodies on body.validate_* instead. Both branches are declared because both are
// true of the framework; which one fires is the body's business, not this file's.
import {
  byStatus, errorEnvelope, z,
  type Ask, type ExceptionPackage,
} from "@rb/schema";

const envelope = (body: z.ZodType<unknown>) => (ask: Ask) => errorEnvelope(ask, body);

/** A refusal that names no field: denied, not found, no route. */
const bare = z.object({ error: z.string().min(1) }).strict();

/** The decoder gave up. Its own message, not pinned: it names the Go type it wanted. */
const notBound = z.object({
  error: z.literal("invalid_body"),
  detail: z.string().min(1),
}).strict();

/**
 * The validator refused. Each key is the field as it is named on the wire, each value the
 * tag that rejected it -- `required`, `min` -- which is go-playground's vocabulary and not
 * this repository's.
 */
const refused = z.object({
  error: z.literal("validation_failed"),
  fields: z.record(z.string(), z.string()).refine(
    (f) => Object.keys(f).length > 0, { message: "no field was named" }),
}).strict();

const rejection = (ask: Ask) => byStatus(ask, {
  // Nothing reached the validator, so no field is named here whatever the endpoint declares.
  400: { body: notBound, reports: [] },
  // go-playground names the fields in its own words, so the endpoint's (field, rule) pairs
  // do not apply; the schema above is what holds the shape.
  422: { body: refused, reports: [] },
});

export default {
  target: "go:gin",
  because:
    "Gin binds with ShouldBindJSON and validates through the go-playground validator it holds in binding.Validator, reading the rules from the binding: tag. " +
    "The binder and the validator are separate layers, so a body that will not deserialize " +
    "answers 400 and names no field, while one that deserializes and fails a rule answers " +
    "422 naming the fields in go-playground's own vocabulary.",
  schemas: {
    "authorized.denied": envelope(bare),
    "errors.not_found": envelope(bare),
    "errors.unmatched": envelope(bare),
    "body.rejected_all": rejection,
    "body.rejected_first": rejection,
    // Not JSON at all, so it never gets as far as the struct.
    "errors.malformed": (ask: Ask) => byStatus(ask, { 400: { body: notBound, reports: [] } }),
  },
} satisfies ExceptionPackage;
