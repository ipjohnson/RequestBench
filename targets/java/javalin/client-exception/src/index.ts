// java:javalin's error contract.
//
// Javalin has no Bean Validation: it has ctx.bodyValidator, which deserializes into a class,
// runs the check() calls chained onto it, collects the failures and raises
// ValidationException itself.
//
// One consequence is visible in the envelope: Javalin keys failures by the thing it was
// validating rather than by the field inside it, so every entry says REQUEST_BODY and the
// message carries which rule refused. A deserialization failure arrives through the same
// path, as the message DESERIALIZATION_FAILED, which is why the rejection endpoints and
// errors.malformed share one envelope here.
import {
  errorEnvelope, z,
  type Ask, type ExceptionPackage,
} from "@rb/schema";

const envelope = (body: z.ZodType<unknown>) => (ask: Ask) => errorEnvelope(ask, body);

/** A refusal that names no field: denied, not found, no route. */
const bare = z.object({ error: z.string().min(1) }).strict();

/**
 * What ctx.bodyValidator raised. The field is what Javalin was validating -- REQUEST_BODY --
 * and the message is either one of this target's check messages or Javalin's own
 * DESERIALIZATION_FAILED.
 */
const refused = z.object({
  error: z.literal("validation_failed"),
  errors: z.array(z.object({
    field: z.string().min(1),
    message: z.string().min(1),
  }).strict()).min(1),
}).strict();

export default {
  target: "java:javalin",
  because:
    "Javalin validates with ctx.bodyValidator: it deserializes into the class, runs the " +
    "checks chained onto it and raises ValidationException itself. It keys failures by what " +
    "it was validating rather than by the field inside, so every entry says REQUEST_BODY " +
    "and the message says which rule refused. A body it could not deserialize comes through " +
    "the same path as DESERIALIZATION_FAILED, so the rejection endpoints and " +
    "errors.malformed share one envelope. bodyValidator collects every failed check and has " +
    "no mode that stops at the first.",
  schemas: {
    "authorized.denied": envelope(bare),
    "errors.not_found": envelope(bare),
    "errors.unmatched": envelope(bare),
    "body.rejected_all": (ask: Ask) =>
      errorEnvelope(ask, refused, { statuses: [400], fieldErrors: [] }),
    "body.rejected_first": (ask: Ask) =>
      errorEnvelope(ask, refused, { statuses: [400], fieldErrors: [] }),
    "errors.malformed": (ask: Ask) =>
      errorEnvelope(ask, refused, { statuses: [400], fieldErrors: [] }),
  },
} satisfies ExceptionPackage;
