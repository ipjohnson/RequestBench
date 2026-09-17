// python:litestar's error contract.
//
// Litestar builds a msgspec decoder from the type annotated on the `data` parameter and runs
// it before the handler. A body that does not fit raises ValidationException, which carries
// Litestar's own envelope: the status, its own wording, and what msgspec said in `extra`.
//
// msgspec stops at the first field it cannot decode, so `extra` holds one entry however many
// fields are wrong, and the first-error contract is the same answer as the collect-all one.
// A body it could not read at all is a plain ClientException with no `extra` at all, because
// nothing got as far as a field.
import {
  errorEnvelope, z,
  type Ask, type ExceptionPackage,
} from "@rb/schema";

const envelope = (body: z.ZodType<unknown>) => (ask: Ask) => errorEnvelope(ask, body);

/** A refusal that names no field: denied, not found, no route. */
const bare = z.object({ error: z.string().min(1) }).strict();

/** What msgspec refused, in Litestar's envelope. */
const refused = z.object({
  status_code: z.number().int(),
  detail: z.string().min(1),
  extra: z.array(z.object({
    message: z.string().min(1),
    key: z.string(),
    source: z.string(),
  }).strict()).min(1),
}).strict();

/** A body msgspec could not read. No `extra`: nothing reached a field. */
const notBound = z.object({
  status_code: z.number().int(),
  detail: z.string().min(1),
}).strict();

export default {
  target: "python:litestar",
  because:
    "Litestar decodes the `data` parameter with msgspec from the type annotated on it and " +
    "answers ValidationException in its own envelope, with what msgspec said in `extra`. " +
    "msgspec stops at the first field it cannot decode, so `extra` holds one entry however " +
    "many are wrong and the first-error contract is the same answer as the collect-all one. " +
    "A body it could not read carries no `extra`, because nothing reached a field.",
  schemas: {
    "authorized.denied": envelope(bare),
    "errors.not_found": envelope(bare),
    "errors.unmatched": envelope(bare),
    // msgspec's message is its own wording for the rule, and `key` is the field, so the
    // endpoint's pairs do not apply; the schema above is what holds the shape.
    "body.rejected_all": (ask: Ask) =>
      errorEnvelope(ask, refused, { statuses: [400], fieldErrors: [] }),
    "body.rejected_first": (ask: Ask) =>
      errorEnvelope(ask, refused, { statuses: [400], fieldErrors: [] }),
    "errors.malformed": (ask: Ask) =>
      errorEnvelope(ask, notBound, { statuses: [400], fieldErrors: [] }),
  },
} satisfies ExceptionPackage;
