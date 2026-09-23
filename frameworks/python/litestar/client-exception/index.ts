import { z } from "zod";
import { exceptions } from "@rb/tests/kit";

/**
 * Litestar's ValidationException, as its default exception handler writes it: the status, a
 * sentence naming the request, and one entry under extra per failure, with the field's path as
 * key. Litestar leaves out source when it cannot say where the key came from.
 */
const Envelope = z.object({
  status_code: z.number(),
  detail: z.string(),
  extra: z.array(z.object({ message: z.string(), key: z.string(), source: z.string().optional() })).min(1),
});

/** `lines[0].qty` -> `lines.0.qty` */
const fromKey = (key: string) => key.replace(/\[(\d+)\]/g, ".$1");

export default exceptions({
  about:
    "Litestar converts a body to the handler's msgspec Struct and answers a failure with its " +
    "ValidationException, 400, with the field's path under extra[].key. msgspec stops at the " +
    "first failure, so a body with three bad fields names one. A body that is not JSON is the " +
    "same 400 with only a detail. The router answers a path no route matches with 404 and a " +
    "method the path has no handler for with 405.",
  rejected: 400,
  notFound: 404,
  wrongMethod: 405,
  reports: "first",
  envelope: Envelope,
  fields: (b) => b.extra.map((e) => fromKey(e.key)),
  message: (b, f) => b.extra.find((e) => fromKey(e.key) === f)?.message,
});
