import { z } from "zod";
import { exceptions } from "@rb/tests/kit";

const Envelope = z.record(z.string(), z.array(z.string()).min(1));

export default exceptions({
  about:
    "A Django form that fails is answered with JsonResponse(form.errors, " +
    "status=400), as Django's documentation answers a form posted by fetch: " +
    "an object keyed by each failing field's name, each holding that field's " +
    "messages. The names are the form's fields, which are the corpus's own. A " +
    "body that is not JSON is Django's BadRequest, whose 400 is Django's HTML " +
    "error page and names no field.",
  rejected: 400,
  notFound: 404,
  wrongMethod: 405,
  envelope: Envelope,
  fields: (b) => Object.keys(b),
  message: (b, f) => b[f]?.[0],
});
