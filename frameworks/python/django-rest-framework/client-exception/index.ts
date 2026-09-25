import { z } from "zod";
import { exceptions, field } from "@rb/tests/kit";

/**
 * A serializer's errors, as DRF's ValidationError carries them. A field holds its messages, or, for
 * a nested serializer, that serializer's errors, or, for a list, the errors of each entry keyed by
 * its index. The errors of a nested object or a list as a whole sit under non_field_errors.
 */
interface Errors {
  readonly [name: string]: readonly string[] | Errors;
}

const Envelope: z.ZodType<Errors> = z.lazy(() => z.record(z.string(), z.union([z.array(z.string()).min(1), Envelope])));

/** DRF's NON_FIELD_ERRORS_KEY, under which a serializer names the errors of the value it binds. */
const WHOLE = "non_field_errors";

const isMessages = (value: readonly string[] | Errors): value is readonly string[] => Array.isArray(value);

/** Every field that failed, in the corpus's spelling, with its messages. */
function failed(errors: Errors, at: readonly string[] = []): [string, readonly string[]][] {
  return Object.entries(errors).flatMap(([name, value]): [string, readonly string[]][] => {
    const path = name === WHOLE ? at : [...at, name];
    return isMessages(value) ? [[field(...path), value]] : failed(value, path);
  });
}

export default exceptions({
  about:
    "A serializer that fails raises DRF's ValidationError, which DRF's exception handler answers " +
    "with 400 and the serializer's errors: an object keyed by each failing field's name, holding " +
    "its messages. The names are the serializer's fields, which are the corpus's own. A nested " +
    "serializer's errors nest under its field, a list's entries are keyed by their index, and an " +
    "error of a nested value as a whole sits under non_field_errors. A body that is not JSON is the " +
    "parser's ParseError, whose 400 is a detail message and names no field.",
  rejected: 400,
  malformed: 400,
  notFound: 404,
  wrongMethod: 405,
  envelope: Envelope,
  fields: (b) => failed(b).map(([f]) => f),
  message: (b, f) => failed(b).find(([name]) => name === f)?.[1][0],
});
