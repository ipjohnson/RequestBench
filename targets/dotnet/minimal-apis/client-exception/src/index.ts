// dotnet:minimal-apis' error contract.
//
// Validation is the framework's own: AddValidation(), new in .NET 10, checks the
// DataAnnotations on the parameter's type before the handler runs and answers a
// ValidationProblem itself. The routes used to take a JsonElement, which made the
// attributes inert.
//
// Minimal APIs keeps its two layers apart, and dotnet:aspnet-mvc does not. A body the
// framework could not read is a bare ProblemDetails with no errors at all; one that
// deserialized and then failed an attribute carries them. MVC routes both through
// ModelState and answers one shape for either. Same runtime, same attributes, different
// layering.
import {
  errorEnvelope, fieldErrorMap, problemDetails, z,
  type Ask, type ExceptionPackage,
} from "@rb/schema";

const envelope = (body: z.ZodType<unknown>) => (ask: Ask) => errorEnvelope(ask, body);

/**
 * A refusal that names no field: denied, not found, no route. Results.Problem answers all
 * three, so they are RFC 7807 like everything else this target sends.
 */
const bare = problemDetails();

/** The framework could not read the body. Nothing validated it, so nothing names a field. */
const notBound = problemDetails();

export default {
  target: "dotnet:minimal-apis",
  because:
    "Validation is AddValidation(), the framework's own, which checks the DataAnnotations " +
    "on the parameter's type before the handler runs. A body it could not read is answered " +
    "as a bare ProblemDetails with no errors, which is where minimal APIs differs from MVC: " +
    "MVC routes a parse failure through ModelState and answers the same shape as a " +
    "validation failure. DataAnnotations collects every attribute that failed, so the " +
    "first-error contract is the same answer as the collect-all one.",
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
 * The shape AddValidation() produces when the attributes are what refused, which the plan
 * never reaches. Exported so the package's own test describes it rather than leaving it
 * undescribed. Note the absent type and status: this is not Results.ValidationProblem.
 */
export const validationFailure = z.object({
  title: z.string().min(1),
  errors: fieldErrorMap,
}).strict();
