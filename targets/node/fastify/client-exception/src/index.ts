// node:fastify's error contract.
//
// Fastify compiles the schema.body declared on each route and runs it with the ajv it
// bundles, before the handler. What it answers is Fastify's own envelope -- a statusCode, a
// code, the status text and ajv's message -- and the code is what says which layer refused:
// FST_ERR_VALIDATION for a body that failed the schema, FST_ERR_CTP_INVALID_JSON for one the
// parser could not read.
//
// Both answer 400, because to Fastify a wrong type is a schema violation rather than a parse
// failure. That is the opposite of a typed binder: go:gin answers 400 for the same body
// without the validator ever running, and this is what #35 exists to surface.
import {
  errorEnvelope, z,
  type Ask, type ExceptionPackage,
} from "@rb/schema";

const envelope = (body: z.ZodType<unknown>) => (ask: Ask) => errorEnvelope(ask, body);

/** A refusal that names no field: denied, not found, no route. */
const bare = z.object({ error: z.string().min(1) }).strict();

/** Fastify's own error envelope, with the code left to say which layer refused. */
const fastifyError = (code: string) => z.object({
  statusCode: z.number().int(),
  code: z.literal(code),
  error: z.string().min(1),
  message: z.string().min(1),
}).strict();

export default {
  target: "node:fastify",
  because:
    "Fastify runs a schema.body through the ajv it bundles and answers a failure in its own " +
    "envelope, keyed by a code: FST_ERR_VALIDATION when the schema refused the body and " +
    "FST_ERR_CTP_INVALID_JSON when the parser could not read it. Both are 400, because to " +
    "Fastify a wrong type is a schema violation and not a parse failure. ajv runs with " +
    "allErrors false, Fastify's own setting, so it reports the first failure and the " +
    "first-error contract is indistinguishable from the collect-all one here.",
  schemas: {
    "authorized.denied": envelope(bare),
    "errors.not_found": envelope(bare),
    "errors.unmatched": envelope(bare),
    // ajv refused the body. Its message names the field as a JSON pointer -- body/customer_id
    // -- and the rule in its own words, so the endpoint's (field, rule) pairs do not apply.
    "body.rejected_all": (ask: Ask) =>
      errorEnvelope(ask, fastifyError("FST_ERR_VALIDATION"), { statuses: [400], fieldErrors: [] }),
    "body.rejected_first": (ask: Ask) =>
      errorEnvelope(ask, fastifyError("FST_ERR_VALIDATION"), { statuses: [400], fieldErrors: [] }),
    // The parser gave up, so no schema ran and nothing names a field.
    "errors.malformed": (ask: Ask) =>
      errorEnvelope(ask, fastifyError("FST_ERR_CTP_INVALID_JSON"),
        { statuses: [400], fieldErrors: [] }),
  },
} satisfies ExceptionPackage;
