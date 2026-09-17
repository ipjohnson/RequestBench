// rust:axum's error contract.
//
// Json<OrderIn> is axum's binding half: it deserializes into the struct before the
// handler runs and renders its own rejection, as text.
//
// axum separates the two layers and is one of only two targets here that does:
// JsonDataError is a body that parsed and would not fit the type, answered 422, and
// JsonSyntaxError is a body that would not parse, answered 400.
//
// The rules serde cannot state -- a list of at least one line, a qty of at least one --
// are this target's own, because axum has no validation layer to put them in. They answer
// 422 with a field and a rule, and because they are its own they can stop at the first,
// which is why body.rejected_first is still a different answer here.
import {
  errorEnvelope, z,
  type Ask, type ExceptionPackage,
} from "@rb/schema";

const envelope = (body: z.ZodType<unknown>) => (ask: Ask) => errorEnvelope(ask, body);

/** A refusal that names no field: denied, not found, no route. */
const bare = z.object({ error: z.string().min(1) }).strict();

/** What this target's own checks refused, one entry per rule. */
const refused = z.object({
  error: z.literal("validation_failed"),
  errors: z.array(z.object({ field: z.string(), rule: z.string() }).strict()).min(1),
}).strict();

/**
 * What the extractor rendered. It writes plain text, not JSON, so the whole body is one
 * string and there is nothing inside it to pin. That makes this target one of the three
 * answering an error with a body that is not JSON.
 */
const notBound = z.string().min(1);
const notBoundMalformed = notBound;

export default {
  target: "rust:axum",
  because:
    "Json<OrderIn> is axum's binding half: it deserializes into the struct before the " +
    "handler runs and renders its own rejection, as text. axum separates the two layers " +
    "and is one of only two targets here that does: JsonDataError is a body that parsed " +
    "and would not fit the type, answered 422, and JsonSyntaxError is a body that would " +
    "not parse, answered 400.",
  schemas: {
    "authorized.denied": envelope(bare),
    "errors.not_found": envelope(bare),
    "errors.unmatched": envelope(bare),
    // The plan sends a type mismatch here, so the extractor answers and this target's own
    // checks never run. They are what answers a body of the right shape and wrong values.
    "body.rejected_all": (ask: Ask) =>
      errorEnvelope(ask, notBound, {
        statuses: [422], fieldErrors: [], bodyClass: "text",
      }),
    "body.rejected_first": (ask: Ask) =>
      errorEnvelope(ask, notBound, {
        statuses: [422], fieldErrors: [], bodyClass: "text",
      }),
    "errors.malformed": (ask: Ask) =>
      errorEnvelope(ask, notBoundMalformed, {
        statuses: [400], fieldErrors: [], bodyClass: "text",
      }),
  },
} satisfies ExceptionPackage;

/** Exported so the package's own test can check the shape its own checks do produce. */
export const ownChecks = refused;
