// dotnet:wolverine-http's error contract.
//
// Validation is Wolverine's own: WolverineFx.Http.FluentValidation adds middleware that
// finds a validator for the request type and runs it before the endpoint method, compiled
// into the handler rather than reflected over per request. The endpoints used to take a
// JsonElement, so there was no request type for a validator to be found for.
//
// A body Wolverine could not read is its own envelope and its own wording, "Invalid JSON
// format", with the reader's message in detail, the path in instance, and the position it
// stopped at in lineNumber and bytePositionInLine. That is not ProblemDetails-with-errors
// and not a bare ProblemDetails either: a fifth shape among the five .NET targets.
import {
  errorEnvelope, fieldErrorMap, problemDetails, z,
  type Ask, type ExceptionPackage,
} from "@rb/schema";

const envelope = (body: z.ZodType<unknown>) => (ask: Ask) => errorEnvelope(ask, body);

/** A refusal that names no field: denied, not found, no route. */
const bare = problemDetails();

/**
 * Wolverine's own answer for a body it could not read.
 *
 * It surfaces the System.Text.Json reader's failure rather than replacing it, so the
 * position it stopped at is part of the envelope as well as being repeated in the detail
 * text. The numbers are not pinned; that they are reported is.
 */
const notBound = z.object({
  type: z.string(),
  title: z.literal("Invalid JSON format"),
  status: z.number().int(),
  detail: z.string().min(1),
  instance: z.string(),
  lineNumber: z.number().int(),
  bytePositionInLine: z.number().int(),
}).strict();

export default {
  target: "dotnet:wolverine-http",
  because:
    "Validation is Wolverine's own middleware, which finds a validator for the request type " +
    "and runs it before the endpoint method, compiled into the handler rather than " +
    "reflected over. A body it could not read gets Wolverine's own envelope and wording, " +
    "Invalid JSON format, with the reader's message in detail and the path in instance -- " +
    "neither ProblemDetails with errors nor a bare one. FluentValidation collects every rule " +
    "that failed, so the first-error contract is the same answer as the collect-all one.",
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

/** What the middleware answers when it is reached, which the plan never does. */
export const validationFailure = problemDetails({ errors: fieldErrorMap });
