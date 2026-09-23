import { z } from "zod";
import { exceptions, field } from "@rb/tests/kit";

const Envelope = z.object({
  validation_error: z.object({
    body_params: z.array(
      z.object({
        loc: z.array(z.union([z.string(), z.number()])),
        msg: z.string(),
        type: z.string(),
      }),
    ).min(1),
  }),
});

export default exceptions({
  about:
    "Flask-Pydantic answers a failed body with 400 and Pydantic's list of failures under " +
    "validation_error.body_params. Each loc is the field's path within the body, with no source " +
    "segment in front, and a list index arrives as a number. A body that is not JSON is Flask's own " +
    "400 page, which names no field.",
  rejected: 400,
  notFound: 404,
  wrongMethod: 405,
  envelope: Envelope,
  fields: (b) => b.validation_error.body_params.map((d) => field(...d.loc)),
  message: (b, f) => b.validation_error.body_params.find((d) => field(...d.loc) === f)?.msg,
});
