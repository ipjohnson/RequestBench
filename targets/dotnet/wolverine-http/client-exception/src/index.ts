// dotnet:wolverine-http answers RFC 7807, and on a body that will not parse it puts the
// reader's own diagnostics in the envelope.
import {
  errorEnvelope, fieldErrorMap, problemDetails, z,
  type Ask, type ExceptionPackage,
} from "@rb/schema";

const envelope = (body: z.ZodType<unknown>) => (ask: Ask) => errorEnvelope(ask, body);

const validation = problemDetails({ errors: fieldErrorMap });

// System.Text.Json's exception is surfaced rather than swallowed, so the position it stopped
// at is part of the envelope. The numbers are not pinned; that they are reported is.
const malformed = problemDetails({
  detail: z.string().min(1),
  instance: z.string(),
  lineNumber: z.number().int(),
  bytePositionInLine: z.number().int(),
});

export default {
  target: "dotnet:wolverine-http",
  because:
    "Wolverine answers RFC 7807, and its middleware surfaces the JSON reader's own failure " +
    "rather than replacing it, so a malformed body reports the line and byte position it " +
    "stopped at alongside the problem details.",
  schemas: {
    "authorized.denied": envelope(problemDetails()),
    "errors.not_found": envelope(problemDetails()),
    "errors.unmatched": envelope(problemDetails()),
    "body.rejected_all": envelope(validation),
    "body.rejected_first": envelope(validation),
    "errors.malformed": envelope(malformed),
  },
} satisfies ExceptionPackage;
