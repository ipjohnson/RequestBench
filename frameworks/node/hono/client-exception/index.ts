import { z } from "zod";
import { exceptions, field } from "@rb/tests/kit";

/** One of zod's issues. An unrecognised key is reported at the object's path, with the keys beside it. */
const Issue = z.object({
  path: z.array(z.union([z.string(), z.number()])),
  message: z.string(),
  keys: z.array(z.string()).optional(),
});

/**
 * zod's issues, which zod 4 writes into its error's message as JSON. JSON.stringify keeps the
 * error's name and message and leaves the issues themselves out.
 */
const Issues = z
  .string()
  .transform((text, ctx) => {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: "error.message is not JSON" });
      return z.NEVER;
    }
  })
  .pipe(z.array(Issue).min(1));

/** What @hono/zod-validator answers a body that fails its schema with: zod's safeParse result as it is. */
const Envelope = z.object({
  success: z.literal(false),
  error: z.object({ name: z.literal("ZodError"), message: Issues }),
});

type Issue = z.infer<typeof Issue>;

/** `["lines", 0, "qty"]` -> `lines.0.qty`, and an unrecognised key by its own name. */
const fieldsOf = (issue: Issue): string[] =>
  issue.keys === undefined ? [field(...issue.path)] : issue.keys.map((key) => field(...issue.path, key));

export default exceptions({
  about:
    "@hono/zod-validator answers a body that fails its zod schema with 400 and zod's safeParse " +
    "result as JSON. zod 4 keeps its issues in the error's message, as a JSON string, so the " +
    "fields are read out of that. zod reports every field that fails, and the first-error route " +
    "runs the validator one field at a time. A body that is not JSON is refused by Hono's " +
    "validator with 400 and text/plain before zod runs. The router answers a path no route " +
    "matches, and a method the path has no route for, with the same 404 as text/plain.",
  rejected: 400,
  malformed: 400,
  notFound: 404,
  wrongMethod: 404,
  envelope: Envelope,
  fields: (b) => b.error.message.flatMap(fieldsOf),
  message: (b, f) => b.error.message.find((issue) => fieldsOf(issue).includes(f))?.message,
});
