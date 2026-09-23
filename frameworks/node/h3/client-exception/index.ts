import { z } from "zod";
import { exceptions, field } from "@rb/tests/kit";

/**
 * h3's error JSON: the status, the statusText when the error carries one, and the message. A
 * validation error adds `data`, holding the Standard Schema issues the schema reported.
 */
const Envelope = z.object({
  status: z.number(),
  statusText: z.string().optional(),
  message: z.string(),
  data: z
    .object({
      issues: z.array(z.object({ path: z.array(z.union([z.string(), z.number()])), message: z.string() })),
      message: z.string(),
    })
    .optional(),
});

type Body = z.infer<typeof Envelope>;

const issues = (b: Body) => b.data?.issues ?? [];

export default exceptions({
  about:
    "h3 writes every refusal as its own error JSON. A body its zod schema refuses is 400 with " +
    "statusText and message 'Validation failed', and data.issues lists the issues zod reported, " +
    "each with the path of the value it names. zod reports every field that fails, so the validate " +
    "routes name all three of order.invalid's, and the first-error route, which runs one field's " +
    "schema at a time, names the first. A body that is not JSON is readBody's 400 'Invalid JSON " +
    "body', which names no field. The router answers a path no route matches, and a method the " +
    "path has no route for, with the same 404.",
  rejected: 400,
  notFound: 404,
  wrongMethod: 404,
  envelope: Envelope,
  fields: (b) => issues(b).map((i) => field(...i.path)),
  message: (b, f) => issues(b).find((i) => field(...i.path) === f)?.message,
});
