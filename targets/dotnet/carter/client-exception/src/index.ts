// dotnet:carter answers RFC 7807 throughout, from the ASP.NET Core problem details service
// Carter sits on top of.
import {
  errorEnvelope, fieldErrorMap, problemDetails, z,
  type Ask, type ExceptionPackage,
} from "@rb/schema";

const envelope = (body: z.ZodType<unknown>) => (ask: Ask) => errorEnvelope(ask, body);

const validation = problemDetails({ errors: fieldErrorMap });

export default {
  target: "dotnet:carter",
  because:
    "Carter answers every error through the ASP.NET Core problem details service, so the " +
    "envelope is RFC 7807 rather than this repository's. A body that will not parse is " +
    "rejected before the validator runs, so that one carries no field map.",
  schemas: {
    "authorized.denied": envelope(problemDetails()),
    "errors.not_found": envelope(problemDetails()),
    "errors.unmatched": envelope(problemDetails()),
    "body.rejected_all": envelope(validation),
    "body.rejected_first": envelope(validation),
    // Rejected by the JSON reader before any validator sees it, so there is no field map.
    "errors.malformed": envelope(problemDetails()),
  },
} satisfies ExceptionPackage;
