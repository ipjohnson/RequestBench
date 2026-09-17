// dotnet:carter's error contract.
//
// Carter 10 ships no validation of its own -- the IValidator wiring it carried in older
// versions is gone -- so this target takes FluentValidation directly and the route runs it.
// That is a handler calling a validator, which the other four avoid, and it is the honest
// description of a framework with no hook to put one in.
//
// Because the validator runs inside the route, a body the binder could not read never gets
// there: that answers a bare ProblemDetails with no errors, the same as
// dotnet:minimal-apis.
import {
  errorEnvelope, fieldErrorMap, problemDetails, z,
  type Ask, type ExceptionPackage,
} from "@rb/schema";

const envelope = (body: z.ZodType<unknown>) => (ask: Ask) => errorEnvelope(ask, body);

/** A refusal that names no field: denied, not found, no route. */
const bare = problemDetails();

/** The binder could not read the body, so the route never ran and nothing names a field. */
const notBound = problemDetails();

export default {
  target: "dotnet:carter",
  because:
    "Carter 10 ships no validation, so this target takes FluentValidation directly and the " +
    "route runs it -- the only one of the five where a handler calls a validator, because " +
    "it is the only one with no hook to put one in. A body the binder could not read never " +
    "reaches the route, so that answers a bare ProblemDetails with no errors. " +
    "FluentValidation collects every rule that failed, so the first-error contract is the " +
    "same answer as the collect-all one.",
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

/** What the validator answers when it is reached, which the plan never does. */
export const validationFailure = problemDetails({ errors: fieldErrorMap });
