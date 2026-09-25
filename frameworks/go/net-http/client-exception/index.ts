import { z } from "zod";
import { exceptions } from "@rb/tests/kit";

/**
 * The refusal the handlers write with encoding/json's encoder, because net/http's own http.Error
 * writes text: the error's own text under `error`.
 */
const Envelope = z.object({ error: z.string() });

/**
 * One line per rule a body breaks, as errors.Join joins them: the field as the client sent it, a
 * colon, and what the value must be, as in `lines[0].qty: must be greater than 0`. A message from
 * the decoder names no field.
 */
const BROKEN = /^([A-Za-z]\w*(?:\[\d+\]\.[A-Za-z]\w*)*): (must .+)$/;

/** `lines[0].qty` -> `lines.0.qty` */
const fromPath = (path: string) => path.replace(/\[(\d+)\]/g, ".$1");

const broken = (body: { error: string }) =>
  body.error.split("\n").flatMap((line) => {
    const m = BROKEN.exec(line);
    return m ? [{ field: fromPath(m[1]!), message: m[2]! }] : [];
  });

export default exceptions({
  about:
    "net/http writes no JSON refusal of its own, and its http.Error writes text. The handlers " +
    "decode with encoding/json, check each rule themselves, and answer a failure with 400 and the " +
    "error's text under error, written with encoding/json's encoder. errors.Join puts each rule a " +
    "body breaks on a line of its own, naming the field as the client sent it. A body that is not " +
    "JSON gets the decoder's own message, which names no field. The ServeMux answers a path no " +
    "pattern matches with net/http's 404 text, and a method the path has no pattern for with 405, " +
    "its text and an Allow header.",
  rejected: 400,
  notFound: 404,
  wrongMethod: 405,
  envelope: Envelope,
  fields: (b) => broken(b).map((f) => f.field),
  message: (b, f) => broken(b).find((x) => x.field === f)?.message,
});
