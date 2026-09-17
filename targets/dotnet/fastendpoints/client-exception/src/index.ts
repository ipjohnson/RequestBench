// dotnet:fastendpoints' error contract.
//
// Validation is FastEndpoints' own: a Validator<TRequest> is discovered and run against
// the bound request before the handler is entered, and the framework answers its own
// ErrorResponse itself. The endpoints used to read HttpContext.Request by hand, which meant
// no request type and nothing for a validator to attach to.
//
// Two things make this target the odd one out among the five. It is the only one that
// separates the layers -- 400 when the binder could not read the body, 422 when the
// validator refused it -- where the other four answer 400 for both. And it reports the
// field by its name on the wire, customer_id, where DataAnnotations and Wolverine both
// report the CLR property, CustomerId.
import {
  errorEnvelope, fieldErrorMap, z,
  type Ask, type ExceptionPackage,
} from "@rb/schema";

const envelope = (body: z.ZodType<unknown>) => (ask: Ask) => errorEnvelope(ask, body);

/** A refusal that names no field: SendForbidden and SendNotFound write this. */
const sent = z.object({
  message: z.string().min(1),
  statusCode: z.number().int(),
}).strict();

/** A route no endpoint claims never reaches the framework, so the host's 404 answers it. */
const unmatched = z.object({ error: z.string().min(1) }).strict();

/** ErrorResponse, which is what both the binder and the validator answer through. */
const errorResponse = z.object({
  status_code: z.number().int(),
  message: z.string().min(1),
  errors: fieldErrorMap,
}).strict();

export default {
  target: "dotnet:fastendpoints",
  because:
    "Validation is a Validator<TRequest>, discovered and run against the bound request " +
    "before the handler, answered in FastEndpoints' own ErrorResponse. It is the only one " +
    "of the five .NET targets that separates the layers -- 400 for a body the binder could " +
    "not read, 422 for one the validator refused -- and the only one reporting the field by " +
    "its name on the wire rather than the CLR property. FluentValidation collects every " +
    "rule that failed, so the first-error contract is the same answer as the collect-all one.",
  schemas: {
    "authorized.denied": envelope(sent),
    "errors.not_found": envelope(sent),
    "errors.unmatched": envelope(unmatched),
    // The binder refused the body, so the message is System.Text.Json's.
    "body.rejected_all": (ask: Ask) =>
      errorEnvelope(ask, errorResponse, { statuses: [400], fieldErrors: [] }),
    "body.rejected_first": (ask: Ask) =>
      errorEnvelope(ask, errorResponse, { statuses: [400], fieldErrors: [] }),
    "errors.malformed": (ask: Ask) =>
      errorEnvelope(ask, errorResponse, { statuses: [400], fieldErrors: [] }),
  },
} satisfies ExceptionPackage;

/** The same envelope at 422, which is what the validator answers. Never reached by the plan. */
export const validationFailure = errorResponse;
