// dotnet:aspnet-mvc's error contract.
//
// Validation is MVC's own: [ApiController] makes it check ModelState against the
// DataAnnotations on the body type before the action is entered, and answer
// InvalidModelStateResponseFactory's ProblemDetails itself. The actions used to take a
// JsonElement, which made the attributes inert.
//
// MVC routes a parse failure through ModelState too, so one envelope covers both layers:
// a wrong type arrives as errors keyed by the JSON path it failed at ($.customer_id), a
// missing field as errors keyed by the CLR property (CustomerId). dotnet:minimal-apis keeps
// the two apart and answers a bare ProblemDetails for the parse.
import {
  errorEnvelope, fieldErrorMap, problemDetails, z,
  type Ask, type ExceptionPackage,
} from "@rb/schema";

const envelope = (body: z.ZodType<unknown>) => (ask: Ask) => errorEnvelope(ask, body);

/** A refusal that names no field. MVC's 403 leaves the filter before the factory runs. */
const bare = z.object({ status: z.number().int() }).strict();

/** ProblemDetails with the validation map, which is what MVC answers for either layer. */
const refused = problemDetails({ errors: fieldErrorMap });

export default {
  target: "dotnet:aspnet-mvc",
  because:
    "Validation is MVC's own: [ApiController] checks ModelState against the DataAnnotations " +
    "before the action is entered and answers InvalidModelStateResponseFactory's " +
    "ProblemDetails. MVC routes a parse failure through ModelState as well, so one envelope " +
    "covers both layers -- a wrong type keyed by the JSON path it failed at, a missing field " +
    "by the CLR property name. DataAnnotations collects every attribute that failed, so the " +
    "first-error contract is the same answer as the collect-all one.",
  schemas: {
    "authorized.denied": envelope(bare),
    "errors.not_found": envelope(problemDetails()),
    "errors.unmatched": envelope(problemDetails()),
    "body.rejected_all": (ask: Ask) =>
      errorEnvelope(ask, refused, { statuses: [400], fieldErrors: [] }),
    "body.rejected_first": (ask: Ask) =>
      errorEnvelope(ask, refused, { statuses: [400], fieldErrors: [] }),
    "errors.malformed": (ask: Ask) =>
      errorEnvelope(ask, refused, { statuses: [400], fieldErrors: [] }),
  },
} satisfies ExceptionPackage;

/**
 * The same schema again, under the name the other four use for the shape their validator
 * produces. For MVC there is only one: a parse failure and a validation failure go through
 * ModelState together and come out identical but for which keys the errors map carries.
 */
export const validationFailure = refused;
