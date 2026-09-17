// java:spring-boot's error contract.
//
// Spring runs Bean Validation on a controller parameter marked @Valid before the method is
// entered, and raises MethodArgumentNotValidException itself when a constraint fails. The
// field it reports is the Java property -- customerId, not customer_id -- because that is
// what the binding is named; nothing here translates it back.
//
// Jackson fails first, though. The body spec/plan.json sends to the rejection endpoints is a
// type mismatch, so HttpMessageNotReadableException is raised before Bean Validation runs
// and the validator never sees it. That is the same order a Go binder works in, and the
// opposite of ajv and Pydantic, which treat a wrong type as something to validate.
import {
  errorEnvelope, z,
  type Ask, type ExceptionPackage,
} from "@rb/schema";

const envelope = (body: z.ZodType<unknown>) => (ask: Ask) => errorEnvelope(ask, body);

/** A refusal that names no field: denied, not found, no route. */
const bare = z.object({ error: z.string().min(1) }).strict();

/** Hibernate Validator's findings, as Spring's binding result reports them. */
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
  target: "java:spring-boot",
  because:
    "Spring runs Jakarta Bean Validation on a @Valid controller parameter and raises " +
    "MethodArgumentNotValidException itself, reporting the Java property name and " +
    "Hibernate Validator's own message. Jackson runs first: a body that will not " +
    "deserialize into the record raises HttpMessageNotReadableException and the validator " +
    "never sees it, which is why the rejection endpoints answer the unreadable-body " +
    "envelope. Hibernate Validator collects every constraint and has no fail-fast mode " +
    "short of configuring the factory for the whole application, so the first-error " +
    "contract is the same answer as the collect-all one.",
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
