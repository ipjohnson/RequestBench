// go:chi's error contract.
//
// chi has no validation layer to plug into, so it validates in the handler and holds its
// own walk in targets/go/chi/validation.go. That walk reads the body as a value rather than
// binding it to a struct, so it sees every field that is wrong instead of stopping where a
// decoder would, and it still reports the (field, rule) pairs the endpoint declares.
//
// That is also why body.rejected_all and body.rejected_first still differ here while they no
// longer do for gin, echo and fiber: those three stop at the first type error in the binder,
// and this one walks past it.
import {
  byStatus, errorEnvelope, z,
  type Ask, type ExceptionPackage,
} from "@rb/schema";

const envelope = (body: z.ZodType<unknown>) => (ask: Ask) => errorEnvelope(ask, body);

/** A refusal that names no field: denied, not found, no route. */
const bare = z.object({ error: z.string().min(1) }).strict();

/** The decoder gave up before the handler saw anything. */
const notBound = z.object({
  error: z.literal("invalid_body"),
  detail: z.string().min(1),
}).strict();

/** One entry per field the walk refused, in the order it walked them. */
const refused = z.object({
  error: z.literal("validation_failed"),
  errors: z.array(z.object({ field: z.string(), rule: z.string() }).strict()).min(1),
}).strict();

export default {
  target: "go:chi",
  because:
    "chi has no validation layer, so per #35 it validates in the handler and holds its own " +
    "walk rather than sharing one. Reading the body as a value rather than binding it to a " +
    "struct is what lets it report every field that is wrong, and what keeps the first-error " +
    "contract different from the collect-all one.",
  schemas: {
    "authorized.denied": envelope(bare),
    "errors.not_found": envelope(bare),
    "errors.unmatched": envelope(bare),
    // The body parses, so the walk always runs and the endpoint's own pairs are what it
    // reports. No override here: those pairs are true of this target.
    "body.rejected_all": envelope(refused),
    "body.rejected_first": envelope(refused),
    // Not JSON at all, so the decoder answers and the walk never runs.
    "errors.malformed": (ask: Ask) => byStatus(ask, { 400: { body: notBound, reports: [] } }),
  },
} satisfies ExceptionPackage;
