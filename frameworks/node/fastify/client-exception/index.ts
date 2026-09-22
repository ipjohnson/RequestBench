import { z } from "zod";
import { exceptions, fromPointer } from "@rb/tests/kit";

const Envelope = z.object({
  statusCode: z.number(),
  error: z.string(),
  message: z.string(),
});

/** `body/lines/0/qty must be > 0` -> `lines/0/qty` */
const SOURCED = /^(?:body|query|params|headers)\/(\S+)/;

export default exceptions({
  about:
    "Fastify serialises an ajv failure as one sentence and puts no field list " +
    "anywhere in the body, so the field is read off the front of the message. " +
    "ajv also stops at the first failure, so a body with two bad fields names " +
    "one. If a version ever emits a structured list this regex returns nothing " +
    "and body.rejected_all fails, which is the intended failure.",
  rejected: 400,
  notFound: 404,
  wrongMethod: 404,
  reports: "first",
  envelope: Envelope,
  fields: (b) => {
    const m = SOURCED.exec(b.message);
    return m ? [fromPointer(m[1]!)] : [];
  },
  message: (b) => b.message,
});
