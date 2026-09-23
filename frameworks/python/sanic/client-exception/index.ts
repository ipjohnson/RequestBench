import { z } from "zod";
import { exceptions, field } from "@rb/tests/kit";

const Envelope = z.object({
  description: z.string(),
  status: z.number(),
  message: z.string(),
});

/**
 * The failures a refusal's message holds. sanic-ext writes Pydantic's own account of them into
 * `message`, after its first line: each failure is its field's dotted path on a line of its own,
 * then its message indented under it.
 */
function failures(message: string): Map<string, string> {
  const out = new Map<string, string>();
  const lines = message.split("\n").slice(1);
  lines.forEach((line, i) => {
    if (line.startsWith(" ")) return;
    const text = lines[i + 1]?.trim().replace(/ \[type=.*$/, "");
    out.set(field(...line.split(".")), text ?? "");
  });
  return out;
}

export default exceptions({
  about:
    "Sanic answers a failed model with 400, rendering sanic-ext's ValidationError as its own " +
    "error JSON. The failures are not structured: `message` is sanic-ext's line naming the " +
    "model followed by Pydantic's text account, one field's dotted path per line with its " +
    "message indented under it. A body that is not JSON is Sanic's own 400 with no field.",
  rejected: 400,
  notFound: 404,
  wrongMethod: 405,
  envelope: Envelope,
  fields: (b) => [...failures(b.message).keys()],
  message: (b, f) => failures(b.message).get(f),
});
