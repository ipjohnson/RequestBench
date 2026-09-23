import { z } from "zod";
import { exceptions, fromPointer } from "@rb/tests/kit";

/**
 * vertx-web-validation's BadRequestException, as the router's error handler for 400 writes it
 * with the exception's own toJson(). A body the schema refuses has the validator's report as
 * causeMessage: every error it found, each an OutputUnit as JSON, inside a line of text.
 */
const Envelope = z.object({
  type: z.string(),
  message: z.string(),
  causeType: z.string().optional(),
  causeMessage: z.string().optional(),
});

type Body = z.infer<typeof Envelope>;

const Units = z.array(z.object({ instanceLocation: z.string(), error: z.string() }));

/** The errors in the validator's report, or none where the refusal is not the schema's. */
function units(b: Body): z.infer<typeof Units> {
  const report = /\{ errors: (\[.*\]), annotations: /s.exec(b.causeMessage ?? "");
  if (report === null) return [];
  try {
    return Units.parse(JSON.parse(report[1]!));
  } catch {
    return [];
  }
}

/** `#/lines/0/qty` -> `lines.0.qty`. `#` is the body itself, which names no field. */
const fieldOf = (location: string): string => fromPointer(location.replace(/^#/, ""));

const named = (b: Body): string[] => [...new Set(units(b).map((u) => fieldOf(u.instanceLocation)).filter((f) => f !== ""))];

export default exceptions({
  about:
    "vertx-web-validation's ValidationHandler fails a request with 400 and a BadRequestException, " +
    "which the router's error handler writes as the exception's toJson(). For a body the schema " +
    "refuses, causeMessage is the validator's report of every error it found, each naming its value " +
    "by a JSON pointer. A body that is not JSON is refused the same way, as a parsing error that " +
    "names no field. The router answers a path no route matches with 404 and a method the path " +
    "has no route for with 405.",
  rejected: 400,
  notFound: 404,
  wrongMethod: 405,
  envelope: Envelope,
  fields: named,
  message: (b, f) => units(b).filter((u) => fieldOf(u.instanceLocation) === f).at(-1)?.error,
});
