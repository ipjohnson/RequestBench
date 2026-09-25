import { z } from "zod";
import { exceptions } from "@rb/tests/kit";

/**
 * Huma's error model: RFC 9457 problem details, written as application/problem+json. A refusal lists
 * each broken rule under errors, with where it was and what was there.
 */
const Envelope = z.object({
  title: z.string(),
  status: z.number(),
  detail: z.string().optional(),
  errors: z.array(z.object({ message: z.string().optional(), location: z.string().optional(), value: z.unknown().optional() })).optional(),
});

/** `body.lines[0].qty` -> `lines.0.qty`. An error at `body` alone, such as a body that does not parse, names no field. */
const IN_BODY = /^body\.(.+)$/;

const inBody = (b: z.infer<typeof Envelope>) =>
  (b.errors ?? []).flatMap((e) => {
    const m = IN_BODY.exec(e.location ?? "");
    return m ? [{ field: m[1]!.replace(/\[(\d+)\]/g, ".$1"), message: e.message }] : [];
  });

export default exceptions({
  about:
    "Huma answers every error it writes with its own RFC 9457 problem details, as " +
    "application/problem+json. A body that breaks its schema is refused with 422, and each rule it " +
    "breaks is an entry under errors, whose location names the field by its path under body. A body " +
    "that does not parse is refused with 400 and one entry at body, holding the decoder's message. " +
    "The first-error route answers the first rule alone, from Huma's validator run over one field at " +
    "a time. A path no operation matches gets the ServeMux's 404 text, and a method the path has no " +
    "operation for gets its 405 text and an Allow header.",
  rejected: 422,
  malformed: 400,
  notFound: 404,
  wrongMethod: 405,
  envelope: Envelope,
  fields: (b) => inBody(b).map((f) => f.field),
  message: (b, f) => inBody(b).find((x) => x.field === f)?.message,
});
