// java:micronaut's error contract.
//
// micronaut-validation generates the validator at compile time from the annotations on the
// record -- the processor, not reflection at startup, which is the point of Micronaut -- and
// Micronaut runs it on a @Valid parameter before the controller method is entered.
//
// A body it could not read is answered by Micronaut itself, in HAL: a message, the findings
// under _embedded.errors, and _links. That envelope is not replaced here. Its link set is
// hypermedia and legitimately varies, so the scaffolding is allowed through while the two
// message paths are required; a strict schema over HAL would fail on any added link. The
// bounded part is checked by the package's own test, which asserts no other framework's
// envelope is accepted.
import {
  errorEnvelope, z,
  type Ask, type ExceptionPackage,
} from "@rb/schema";

const envelope = (body: z.ZodType<unknown>) => (ask: Ask) => errorEnvelope(ask, body);

/** A refusal that names no field: denied, not found, no route. */
const bare = z.object({ error: z.string().min(1) }).strict();

/** The generated validator's findings, rendered as a list like every other target here. */
const refused = z.object({
  error: z.literal("validation_failed"),
  errors: z.array(z.object({
    field: z.string().min(1),
    message: z.string().min(1),
  }).strict()).min(1),
}).strict();

/** Micronaut's own answer for a body it could not read, in HAL. */
const notBound = z.object({
  message: z.string().min(1),
  _embedded: z.object({
    errors: z.array(z.object({ message: z.string().min(1) }).passthrough()).min(1),
  }).passthrough(),
  _links: z.record(z.string(), z.unknown()),
}).passthrough();

export default {
  target: "java:micronaut",
  because:
    "micronaut-validation generates the validator at compile time and Micronaut runs it on " +
    "a @Valid parameter, reporting the full property path it walked. A body it could not " +
    "read it answers itself, in HAL, and that envelope is left as Micronaut writes it. The " +
    "generated validator collects every constraint, so the first-error contract is the same " +
    "answer as the collect-all one.",
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

/** Exported so the package's own test can check the shape the validator does produce. */
export const validationFailure = refused;
