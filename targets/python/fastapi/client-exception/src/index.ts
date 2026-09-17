// python:fastapi's error contract.
//
// FastAPI builds a validator from the Pydantic model annotated on the body parameter and
// runs it before the handler. What it answers is FastAPI's own RequestValidationError
// envelope: a `detail` list, one entry per finding, each carrying the Pydantic error type,
// the location as a path into the body, a message and the input that failed.
//
// Pydantic draws no line between a wrong type and an unreadable body. Both are entries in
// the same list and both are 422, separated only by the `type`: `int_parsing` against
// `json_invalid`. That is the opposite of a typed binder -- go:gin answers 400 for a wrong
// type without the validator running -- and one of the differences #35 exists to surface.
import {
  errorEnvelope, z,
  type Ask, type ExceptionPackage,
} from "@rb/schema";

const envelope = (body: z.ZodType<unknown>) => (ask: Ask) => errorEnvelope(ask, body);

/** A refusal that names no field: denied, not found, no route. */
const bare = z.object({ error: z.string().min(1) }).strict();

/** One Pydantic finding. `ctx` and `url` are present per error kind, so neither is pinned. */
const finding = (type: z.ZodType<string>) => z.object({
  type,
  loc: z.array(z.union([z.string(), z.number()])).min(1),
  msg: z.string().min(1),
  input: z.unknown(),
  ctx: z.record(z.string(), z.unknown()).optional(),
  url: z.string().optional(),
}).strict();

const detail = (type: z.ZodType<string>) =>
  z.object({ detail: z.array(finding(type)).min(1) }).strict();

export default {
  target: "python:fastapi",
  because:
    "FastAPI validates against the Pydantic model annotated on the body parameter and " +
    "answers its own RequestValidationError envelope: a detail list, one entry per finding. " +
    "Pydantic treats a wrong type and an unreadable body as the same kind of thing -- both " +
    "422, separated by the entry's type -- where a typed binder fails deserialization " +
    "before any rule runs. Pydantic collects every error and offers no way to stop at the " +
    "first, so the first-error contract is the same answer as the collect-all one.",
  schemas: {
    "authorized.denied": envelope(bare),
    "errors.not_found": envelope(bare),
    "errors.unmatched": envelope(bare),
    // The field is in `loc` and the rule is the Pydantic `type`, neither of which is this
    // repository's vocabulary, so the schema above is what holds the shape.
    "body.rejected_all": (ask: Ask) =>
      errorEnvelope(ask, detail(z.string().min(1)), { fieldErrors: [] }),
    "body.rejected_first": (ask: Ask) =>
      errorEnvelope(ask, detail(z.string().min(1)), { fieldErrors: [] }),
    // The same envelope, and the type is what says the parser is what gave up.
    "errors.malformed": (ask: Ask) =>
      errorEnvelope(ask, detail(z.literal("json_invalid")), { statuses: [422], fieldErrors: [] }),
  },
} satisfies ExceptionPackage;
