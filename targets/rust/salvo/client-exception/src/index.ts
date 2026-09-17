// rust:salvo's error contract.
//
// req.parse_json::<OrderIn>() is salvo's binding half: it deserializes into the struct
// and hands back its own ParseError, which this target renders.
//
// salvo does not separate the two layers: both arrive as a ParseError and both answer
// 400, where axum answers 422 for a body that parsed and would not fit.
//
// The rules serde cannot state -- a list of at least one line, a qty of at least one --
// are this target's own, because salvo has no validation layer to put them in. They
// answer
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

/** What the extractor refused, in this target's own envelope. */
const notBound = z.object({
  error: z.literal("invalid_body"),
  detail: z.string().min(1),
}).strict();
const notBoundMalformed = notBound;

export default {
  target: "rust:salvo",
  because:
    "req.parse_json::<OrderIn>() is salvo's binding half: it deserializes into the " +
    "struct" +
    "and hands back its own ParseError, which this target renders. salvo does not " +
    "separate the two layers: both arrive as a ParseError and both answer 400, where " +
    "axum" +
    "answers 422 for a body that parsed and would not fit.",
  schemas: {
    "authorized.denied": envelope(bare),
    "errors.not_found": envelope(bare),
    "errors.unmatched": envelope(bare),
    // The plan sends a type mismatch here, so the extractor answers and this target's own
    // checks never run. They are what answers a body of the right shape and wrong values.
    "body.rejected_all": (ask: Ask) =>
      errorEnvelope(ask, notBound, {
        statuses: [400], fieldErrors: [], bodyClass: "json",
      }),
    "body.rejected_first": (ask: Ask) =>
      errorEnvelope(ask, notBound, {
        statuses: [400], fieldErrors: [], bodyClass: "json",
      }),
    "errors.malformed": (ask: Ask) =>
      errorEnvelope(ask, notBoundMalformed, {
        statuses: [400], fieldErrors: [], bodyClass: "json",
      }),
  },
} satisfies ExceptionPackage;

/** Exported so the package's own test can check the shape its own checks do produce. */
export const ownChecks = refused;
