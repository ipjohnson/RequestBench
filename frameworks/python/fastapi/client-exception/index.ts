import { z } from "zod";
import { exceptions, fromLoc } from "@rb/tests/kit";

const Envelope = z.object({
  detail: z.array(
    z.object({
      loc: z.array(z.union([z.string(), z.number()])),
      msg: z.string(),
      type: z.string(),
    }),
  ).min(1),
});

export default exceptions({
  about:
    "Pydantic answers a failed model with 422, not 400. loc is a path whose " +
    "first element names the source, so the field is the rest of it and a list " +
    "index arrives as a number rather than a string.",
  rejected: 422,
  notFound: 404,
  wrongMethod: 405,
  envelope: Envelope,
  fields: (b) => b.detail.map((d) => fromLoc(d.loc)),
  message: (b, f) => b.detail.find((d) => fromLoc(d.loc) === f)?.msg,
});
