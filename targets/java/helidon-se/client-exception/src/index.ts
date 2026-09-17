// java:helidon-se's error contract.
//
// Helidon SE has no validation layer -- it is a routing and server library, and Bean
// Validation lives in the MP flavour -- so per #35 it validates in its own handler and holds
// its own walk. Reading the body as a value rather than binding it to a record is what lets
// the walk see every field that is wrong instead of stopping where a binder would.
//
// That makes it the only Java target where body.rejected_first is still a different answer
// from body.rejected_all, and the only one that still answers 422: the other five answer 400,
// because each of their binders or validators chose that.
import {
  errorEnvelope, z,
  type Ask, type ExceptionPackage,
} from "@rb/schema";

const envelope = (body: z.ZodType<unknown>) => (ask: Ask) => errorEnvelope(ask, body);

/** A refusal that names no field: denied, not found, no route. */
const bare = z.object({ error: z.string().min(1) }).strict();

/** One entry per field the walk refused, in the order it walked them. */
const refused = z.object({
  error: z.literal("validation_failed"),
  errors: z.array(z.object({ field: z.string(), rule: z.string() }).strict()).min(1),
}).strict();

/** Jackson could not read the body into a map, so the walk never ran. */
const notBound = z.object({
  error: z.literal("invalid_body"),
  detail: z.string().min(1),
}).strict();

export default {
  target: "java:helidon-se",
  because:
    "Helidon SE has no validation layer, so per #35 it validates in its own handler and " +
    "holds its own walk rather than sharing one. The walk reads the body as a value, so it " +
    "reports every field that is wrong, the first-error contract stays a different answer " +
    "from the collect-all one, and 422 is what it chooses -- the only Java target that still " +
    "does, because the other five take their status from a binder or a validator.",
  schemas: {
    "authorized.denied": envelope(bare),
    "errors.not_found": envelope(bare),
    "errors.unmatched": envelope(bare),
    // The body parses, so the walk runs and the endpoint's own pairs are what it reports.
    "body.rejected_all": envelope(refused),
    "body.rejected_first": envelope(refused),
    "errors.malformed": (ask: Ask) =>
      errorEnvelope(ask, notBound, { statuses: [400], fieldErrors: [] }),
  },
} satisfies ExceptionPackage;
