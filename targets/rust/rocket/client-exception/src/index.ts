// rust:rocket's error contract.
//
// Json<OrderIn> is a Rocket data guard, which is its binding half: the guard deserializes
// into the struct before the route is called and fails for a body that will not fit, and
// Rocket's catchers render it.
//
// Rocket separates the two layers the way axum does -- 422 for a body that parsed and
// would not fit the type, 400 for one that would not parse -- and its default for both is
// an HTML page, so this target registers catchers to answer with a body of its own.
//
// A catcher is registered per status, not per guard. The query family binds with a
// FromForm guard, whose refusal is the same 422, so the 422 catcher cannot say which guard
// refused and its envelope names neither.
//
// The rules serde cannot state -- a list of at least one line, a qty of at least one --
// are this target's own, because rocket has no validation layer to put them in. They
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

/**
 * What a guard refused, in this target's own envelope. A catcher is registered per status
 * rather than per guard, so the 422 one cannot tell a body the Json guard would not fit
 * from a query the FromForm guard would not, and its envelope names neither.
 */
const notFitted = z.object({
  error: z.literal("unprocessable"),
  detail: z.string().min(1),
}).strict();

/** The 400 catcher, which only a body that would not parse at all reaches. */
const notBoundMalformed = z.object({
  error: z.literal("invalid_body"),
  detail: z.string().min(1),
}).strict();

export default {
  target: "rust:rocket",
  because:
    "Json<OrderIn> is a Rocket data guard, which is its binding half: the guard " +
    "deserializes into the struct before the route is called and fails for a body that " +
    "will not fit, and Rocket's catchers render it. Rocket separates the two layers the " +
    "way axum does -- 422 for a body that parsed and would not fit the type, 400 for one " +
    "that would not parse -- and its default for both is an HTML page, so this target " +
    "registers catchers to answer with a body of its own.",
  schemas: {
    "authorized.denied": envelope(bare),
    "errors.not_found": envelope(bare),
    "errors.unmatched": envelope(bare),
    // The plan sends a type mismatch here, so the extractor answers and this target's own
    // checks never run. They are what answers a body of the right shape and wrong values.
    "body.rejected_all": (ask: Ask) =>
      errorEnvelope(ask, notFitted, {
        statuses: [422], fieldErrors: [], bodyClass: "json",
      }),
    "body.rejected_first": (ask: Ask) =>
      errorEnvelope(ask, notFitted, {
        statuses: [422], fieldErrors: [], bodyClass: "json",
      }),
    "errors.malformed": (ask: Ask) =>
      errorEnvelope(ask, notBoundMalformed, {
        statuses: [400], fieldErrors: [], bodyClass: "json",
      }),
  },
} satisfies ExceptionPackage;

/** Exported so the package's own test can check the shape its own checks do produce. */
export const ownChecks = refused;
