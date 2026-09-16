// dotnet:aspnet-mvc answers RFC 7807, produced by MVC's InvalidModelStateResponseFactory
// rather than by a handler.
//
// Nothing here pins the body. `traceId` is present per connection and absent when tracing
// is off, and `title` and `type` are the framework's wording. What is pinned is the set of
// keys, so a changed envelope still fails.
import {
  errorEnvelope, fieldErrorMap, problemDetails, z,
  type Ask, type ExceptionPackage,
} from "@rb/schema";

const envelope = (body: z.ZodType<unknown>) => (ask: Ask) => errorEnvelope(ask, body);

// The authorization filter short-circuits before the ProblemDetails factory runs, so a 403
// carries the status and nothing else.
const denied = z.object({ status: z.number().int() }).strict();

// A body JSON.NET could not read is reported against the document root, which MVC names `$`.
const validation = problemDetails({ errors: fieldErrorMap });

export default {
  target: "dotnet:aspnet-mvc",
  because:
    "MVC answers a validation failure with ProblemDetails from its own " +
    "InvalidModelStateResponseFactory: a type, a title, the status, and the failures keyed " +
    "by field. A 403 leaves the filter before that factory runs and carries the status alone.",
  schemas: {
    "authorized.denied": envelope(denied),
    "errors.not_found": envelope(problemDetails()),
    "errors.unmatched": envelope(problemDetails()),
    "body.rejected_all": envelope(validation),
    "body.rejected_first": envelope(validation),
    "errors.malformed": envelope(validation),
  },
} satisfies ExceptionPackage;
