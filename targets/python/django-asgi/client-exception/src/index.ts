// python:django-asgi's error contract.
//
// Django's validation facility is forms. OrderForm declares its fields and is_valid() runs
// each field's own to_python and validate, collecting every error into form.errors, so the
// framework does the work rather than a walk in the view.
//
// Two things follow from using Django's fields rather than this repository's rules, and both
// are the framework being itself rather than a defect:
//
// It reports two of the three fields the endpoint declares, not three. The plan sends
// status: 42, and forms.CharField's to_python calls str() on whatever it is given, so 42
// becomes "42" and the form accepts it. Django's field decides what a string is.
//
// It reports its own codes. A field that refused says `invalid`, not this repository's
// `int` or `array`.
import {
  errorEnvelope, z,
  type Ask, type ExceptionPackage,
} from "@rb/schema";

const envelope = (body: z.ZodType<unknown>) => (ask: Ask) => errorEnvelope(ask, body);

/** A refusal that names no field: denied, not found, no route. */
const bare = z.object({ error: z.string().min(1) }).strict();

/** What form.errors held, keyed by field, with Django's own code as the rule. */
const refused = z.object({
  error: z.literal("validation_failed"),
  errors: z.array(z.object({ field: z.string(), rule: z.string() }).strict()).min(1),
}).strict();

/** Django does not parse a request body, so this is the shared parse giving up. */
const notBound = z.object({
  error: z.literal("invalid_body"),
  detail: z.string().min(1),
}).strict();

// What the form actually names for the body the plan sends, in Django's vocabulary. Stated
// rather than dropped, so a form that stops refusing one of them fails here.
const DJANGO_CODES = [
  ["customer_id", "invalid"],
  ["lines", "invalid"],
] as const;

export default {
  target: "python:django-asgi",
  because:
    "Django validates with forms: OrderForm declares the fields and is_valid() runs each " +
    "field's own to_python and validate. It reports its own codes -- `invalid` rather than " +
    "`int` -- and it accepts status: 42, because CharField's to_python calls str() on it. " +
    "A Form collects every error and offers no way to stop at the first, so the first-error " +
    "contract is the same answer as the collect-all one here.",
  schemas: {
    "authorized.denied": envelope(bare),
    "errors.not_found": envelope(bare),
    "errors.unmatched": envelope(bare),
    "body.rejected_all": (ask: Ask) =>
      errorEnvelope(ask, refused, { fieldErrors: DJANGO_CODES }),
    "body.rejected_first": (ask: Ask) =>
      errorEnvelope(ask, refused, { fieldErrors: DJANGO_CODES }),
    "errors.malformed": (ask: Ask) =>
      errorEnvelope(ask, notBound, { statuses: [400], fieldErrors: [] }),
  },
} satisfies ExceptionPackage;
