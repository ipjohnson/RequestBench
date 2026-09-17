// java:quarkus's error contract.
//
// Quarkus runs Hibernate Validator on a @Valid resource method parameter and raises
// ConstraintViolationException itself. The field it reports is the full property path the
// validator walked -- validateSmall.body.customerId -- which is its vocabulary, not this
// repository's.
//
// Jackson runs first, and Quarkus answers a body it could not deserialize with a bare 400:
// content-length zero, no content-type, and nothing raised. No ExceptionMapper and no
// @ServerExceptionMapper is consulted, verified by mapping Throwable and watching it never
// fire. A ContainerResponseFilter gives that response a body, which is the one place a
// Quarkus answer is reshaped rather than reported; see BodilessErrors for why.
import {
  errorEnvelope, z,
  type Ask, type ExceptionPackage,
} from "@rb/schema";

const envelope = (body: z.ZodType<unknown>) => (ask: Ask) => errorEnvelope(ask, body);

/** A refusal that names no field: denied, not found, no route. */
const bare = z.object({ error: z.string().min(1) }).strict();

/** Hibernate Validator's findings, as the violations reported them. */
const refused = z.object({
  error: z.literal("validation_failed"),
  errors: z.array(z.object({
    field: z.string().min(1),
    message: z.string().min(1),
  }).strict()).min(1),
}).strict();

/** Jackson could not read the body into the record. Nothing validated it. */
const notBound = z.object({
  error: z.literal("invalid_body"),
  detail: z.string().min(1),
}).strict();

export default {
  target: "java:quarkus",
  because:
    "Quarkus runs Hibernate Validator on a @Valid resource parameter and raises " +
    "ConstraintViolationException itself, reporting the full property path it walked. " +
    "Jackson runs first: a body that will not deserialize is answered with a bare 400 and " +
    "no exception at all, so a response filter is what gives it a body. Hibernate " +
    "Validator collects every constraint, so the first-error contract is the same answer " +
    "as the collect-all one.",
  schemas: {
    "authorized.denied": envelope(bare),
    "errors.not_found": envelope(bare),
    "errors.unmatched": envelope(bare),
    "body.rejected_all": (ask: Ask) =>
      errorEnvelope(ask, notBound, { statuses: [400], fieldErrors: [] }),
    "body.rejected_first": (ask: Ask) =>
      errorEnvelope(ask, notBound, { statuses: [400], fieldErrors: [] }),
    "errors.malformed": (ask: Ask) =>
      errorEnvelope(ask, notBound, { statuses: [400], fieldErrors: [] }),
  },
} satisfies ExceptionPackage;

/** Exported so the package's own test can check the shape Bean Validation does produce. */
export const validationFailure = refused;
