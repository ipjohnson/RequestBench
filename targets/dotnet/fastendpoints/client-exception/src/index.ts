// dotnet:fastendpoints has its own error response rather than ProblemDetails.
//
// Two of them, in fact: the validation failure is message/status_code, and SendForbidden
// and SendNotFound answer message/statusCode. The casing differs because they come from
// different types in the framework, and neither is this repository's business to correct.
import {
  errorEnvelope, fieldErrorMap, z,
  type Ask, type ExceptionPackage,
} from "@rb/schema";

const envelope = (body: z.ZodType<unknown>) => (ask: Ask) => errorEnvelope(ask, body);

/** ErrorResponse, which is what a failed validator produces. */
const validation = z
  .object({
    message: z.string().min(1),
    status_code: z.number().int(),
    errors: fieldErrorMap,
  })
  .strict();

/** What SendForbidden and SendNotFound write. */
const sent = z
  .object({
    message: z.string().min(1),
    statusCode: z.number().int(),
  })
  .strict();

/** A route no endpoint claims never reaches FastEndpoints, so the host's 404 answers it. */
const unmatched = z.object({ error: z.string().min(1) }).strict();

export default {
  target: "dotnet:fastendpoints",
  because:
    "FastEndpoints answers a validation failure with its own ErrorResponse -- a message, a " +
    "status_code and the failures keyed by field -- rather than ProblemDetails. " +
    "SendForbidden and SendNotFound write a different type again, which spells the same " +
    "field statusCode. A route no endpoint claims never reaches the framework at all.",
  schemas: {
    "authorized.denied": envelope(sent),
    "errors.not_found": envelope(sent),
    "errors.unmatched": envelope(unmatched),
    "body.rejected_all": envelope(validation),
    "body.rejected_first": envelope(validation),
    // The request DTO binder reports a body it could not read against `body`, and that is a
    // validation failure like any other here, so it is 422 rather than 400.
    "errors.malformed": envelope(validation),
  },
} satisfies ExceptionPackage;
