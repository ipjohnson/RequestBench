// node:hono's error contract.
//
// Hono runs the rules through hono/validator, a route-level hook that reads the body, hands it to the check and short circuits when the check answers, so no handler calls a validator. The rules themselves are this target's own.
//
// Reading the body as a value rather than binding it to a shape is what lets the walk see
// every field that is wrong instead of stopping where a parser would, so it still reports
// the (field, rule) pairs the endpoint declares and body.rejected_first is still a different
// answer from body.rejected_all. node:fastify loses that distinction, because ajv reports
// the first failure and nothing after it.
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

/** The parser gave up before anything validated, so no field is named. */
const notBound = z.object({
  error: z.literal("invalid_body"),
  detail: z.string().min(1),
}).strict();

export default {
  target: "node:hono",
  because:
    "Hono runs the rules through hono/validator, a route-level hook that reads the body, hands it to the check and short circuits when the check answers, so no handler calls a validator. The rules themselves are this target's own. " +
    "The walk reads the body as a value, so it reports every field that is wrong and the " +
    "first-error contract stays a different answer from the collect-all one.",
  schemas: {
    "authorized.denied": envelope(bare),
    "errors.not_found": envelope(bare),
    "errors.unmatched": envelope(bare),
    // The body parses, so the walk runs and the endpoint's own pairs are what it reports.
    // No override: those pairs are true of this target.
    "body.rejected_all": envelope(refused),
    "body.rejected_first": envelope(refused),
    // Not JSON at all, so the walk never runs.
    "errors.malformed": (ask: Ask) =>
      errorEnvelope(ask, notBound, { statuses: [400], fieldErrors: [] }),
  },
} satisfies ExceptionPackage;
