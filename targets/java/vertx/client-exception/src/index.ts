// java:vertx's error contract.
//
// vertx-web-validation is a handler, not a call: it is mounted on the route ahead of the
// business handler, validates the body against a JSON schema and fails the routing context
// itself. The handler only ever sees a body that passed.
//
// Failing the context rather than throwing is why the route needs a failureHandler for any
// of this to be rendered at all; without one Vert.x answers its own plain-text "Bad Request".
// And because the handler fails on the first thing that did not fit, there is one detail
// however many fields are wrong, and no collect-all mode to ask for.
import {
  errorEnvelope, z,
  type Ask, type ExceptionPackage,
} from "@rb/schema";

const envelope = (body: z.ZodType<unknown>) => (ask: Ask) => errorEnvelope(ask, body);

/** A refusal that names no field: denied, not found, no route. */
const bare = z.object({ error: z.string().min(1) }).strict();

/**
 * What the ValidationHandler refused, as one line.
 *
 * Vert.x reports the parameter it was validating and the schema failure underneath, and its
 * wording distinguishes a parse failure from a schema failure inside the same envelope. That
 * is one envelope for both, which is what this framework answers.
 */
const refused = z.object({
  error: z.literal("validation_failed"),
  detail: z.string().min(1),
}).strict();

export default {
  target: "java:vertx",
  because:
    "vertx-web-validation mounts a ValidationHandler on the route, which validates the body " +
    "against a JSON schema and fails the routing context rather than throwing -- so the " +
    "route carries a failureHandler, or Vert.x answers its own plain-text Bad Request. It " +
    "fails on the first thing that did not fit, so there is one detail however many fields " +
    "are wrong and no collect-all mode, and a parse failure and a schema failure arrive in " +
    "the same envelope distinguished only by its wording.",
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
