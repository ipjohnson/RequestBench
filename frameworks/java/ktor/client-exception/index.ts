import { z } from "zod";
import { exceptions, field } from "@rb/tests/kit";

/** The reasons RequestValidation gathered, which the StatusPages handler answers as a JSON array. */
const Envelope = z.array(z.string()).min(1);

/** `lines[0].qty must be at least 1` -> `lines.0.qty`. Each reason starts with the field it is about. */
const fieldOf = (reason: string): string => field(...reason.split(" ")[0]!.replace(/\[(\d+)\]/g, ".$1").split("."));

export default exceptions({
  about:
    "RequestValidation throws RequestValidationException with a reason for each rule a body " +
    "breaks, and the StatusPages handler answers it with 400 and the reasons as a JSON array. " +
    "Each reason starts with the field it is about, a line's field as lines[0].qty. A body that " +
    "is not JSON, or does not bind to the order, is Ktor's BadRequestException, whose 400 is a line " +
    "of text that names no field. Ktor's router answers 405 for a method a path has no route for " +
    "only when every segment it matched is a constant, so a method missing from /items/{id} is 404.",
  rejected: 400,
  malformed: 400,
  notFound: 404,
  wrongMethod: 404,
  envelope: Envelope,
  fields: (b) => b.map(fieldOf),
  message: (b, f) => b.find((reason) => fieldOf(reason) === f),
});
