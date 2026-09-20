// dotnet:carter's error contract.
//
// Validation is Carter's own: MapPost<T> and MapPut<T> put Carter's endpoint filter on the
// route, which finds the FluentValidation validator for T and answers 422 with its failures
// before the handler runs.
//
// The binder runs before any endpoint filter, so a body it could not read never reaches the
// validator: that answers a bare ProblemDetails with no errors, the same as
// dotnet:minimal-apis.
import {
  errorEnvelope, problemDetails, z,
  type Ask, type ExceptionPackage,
} from "@rb/schema";

const envelope = (body: z.ZodType<unknown>) => (ask: Ask) => errorEnvelope(ask, body);

/** A refusal that names no field: denied, not found, no route. */
const bare = problemDetails();

/** The binder could not read the body, so neither the filter nor the route ran, and nothing names a field. */
const notBound = problemDetails();

export default {
  target: "dotnet:carter",
  because:
    "Validation is Carter's own: MapPost<T> and MapPut<T> put Carter's endpoint filter on " +
    "the route, which runs the FluentValidation validator for the body and answers 422 with " +
    "a list of property names and messages. A body the binder could not read never reaches " +
    "the filter, so that answers a bare ProblemDetails with no errors. FluentValidation " +
    "collects every rule that failed, so the first-error contract is the same answer as the " +
    "collect-all one.",
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

/**
 * One failure as Carter reports it: its ModelError, with the property name FluentValidation
 * gives and FluentValidation's own message. The target's snake_case naming policy writes
 * the keys.
 */
const modelError = z.object({
  property_name: z.string().min(1),
  error_message: z.string().min(1),
}).strict();

/**
 * What Carter's filter answers when the validator is reached, which the plan never does:
 * 422, with every failure in a list rather than grouped by field.
 */
export const validationFailure = problemDetails({
  status: z.literal(422),
  errors: z.array(modelError).min(1),
});
