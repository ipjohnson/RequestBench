import { z } from "zod";
import { exceptions, field } from "@rb/tests/kit";

/** The BadRequestException ValidationPipe throws, as Nest's exception filter writes it. */
const Envelope = z.object({
  message: z.array(z.string()).min(1),
  error: z.string(),
  statusCode: z.number(),
});

/** `lines.0.qty must not be less than 1` -> `lines.0.qty`. Each message starts with the field it is about. */
const fieldOf = (message: string): string => field(...message.split(" ")[0]!.split("."));

export default exceptions({
  about:
    "ValidationPipe checks the body against class-validator's decorators on its class and throws " +
    "BadRequestException with a message for each rule the body breaks, which Nest's exception " +
    "filter answers with 400 as { message, error, statusCode }. Each message starts with the field " +
    "it is about, a line's field as lines.0.qty. The first-error route checks one field at a time " +
    "and throws at the first that breaks a rule. A body that is not JSON is the body parser's 400, " +
    "whose message is a string, and a path or a method with no route is Nest's 404.",
  rejected: 400,
  malformed: 400,
  notFound: 404,
  wrongMethod: 404,
  reports: "all",
  envelope: Envelope,
  fields: (b) => [...new Set(b.message.map(fieldOf))],
  message: (b, f) => b.message.find((m) => fieldOf(m) === f),
});
