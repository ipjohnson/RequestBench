// What a target is allowed to answer on an error endpoint, as a schema rather than as a
// pinned body.
//
// A 2xx body is the controlled variable and stays pinned exactly. An error response is the
// framework's own contract -- ProblemDetails, a FluentValidation list, a bare object, and the
// status and wording that come with it -- so each framework declares its own in
// targets/<language>/<framework>/client-exception, built from the pieces here.
//
// spec/endpoints.json still declares a status and a set of field errors per endpoint, and
// that is what a framework gets if it says nothing. It is a default, not a requirement: a
// framework whose own facility answers 400 where the endpoint says 422, or writes "must not
// be blank" where the endpoint says `required`, states that in its package and is gated on
// what it actually does. Translating it back would measure the translation.
import { z } from "zod";

export { z };

/** One captured response, which is what a schema is written against. */
export type Answer = {
  readonly status: number;
  readonly body_class: string;
  readonly encoding: string;
  readonly body: unknown;
};

/**
 * What the framework is told about the request it is being asked to describe.
 *
 * `statuses` and `fieldErrors` are what the endpoint declares in spec/endpoints.json. They
 * are the default and not a requirement: a framework whose own facility answers something
 * else says so in its package, through the `instead` argument to `errorEnvelope`.
 */
export type Ask = {
  /** "node:fastify" */
  readonly target: string;
  /** "body.rejected_all" */
  readonly endpoint: string;
  /** "body" */
  readonly family: string;
  readonly method: string;
  /** The resolved concrete path, query string included. */
  readonly path: string;
  /** The statuses spec/plan.json allows, from `accepts` or `expect`. */
  readonly statuses: readonly number[];
  /** The (field, rule) pairs the endpoint says are reported, from spec/plan.json. */
  readonly fieldErrors: readonly (readonly [string, string])[];
};

/** One framework's error contract: a schema per error endpoint, built from the Ask. */
export type ExceptionPackage = {
  /** "node:fastify" */
  readonly target: string;
  /** Why this framework answers the way it does, shown on the scenario page. */
  readonly because: string;
  readonly schemas: Readonly<Record<string, (ask: Ask) => z.ZodType<unknown>>>;
};

// ---- finding a field error, wherever the framework put it ----------------------------

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Every string in a subtree, keys and values alike. */
function stringsOf(node: unknown, out = new Set<string>()): Set<string> {
  if (isObject(node)) {
    for (const k of Object.keys(node)) out.add(k);
    for (const v of Object.values(node)) stringsOf(v, out);
  } else if (Array.isArray(node)) {
    for (const v of node) stringsOf(v, out);
  } else if (typeof node === "string") {
    out.add(node);
  }
  return out;
}

/**
 * Whether a field error is reported somewhere in this body, in either shape anyone uses.
 *
 * Two shapes, because those are the two anyone writes. An object carrying both as values is
 * this repository's own {"field": ..., "rule": ...}; a key equal to the field whose subtree
 * names the rule is what ProblemDetails and the FluentValidation-shaped lists produce.
 * Anything else fails, which is the right outcome: a third shape is worth looking at rather
 * than pattern-matching blind.
 */
export function pairFound(node: unknown, field: string, rule: string): boolean {
  if (isObject(node)) {
    if (field in node && stringsOf(node[field]).has(rule)) return true;
    const values = new Set(Object.values(node).filter((v): v is string => typeof v === "string"));
    if (values.has(field) && values.has(rule)) return true;
    return Object.values(node).some((v) => pairFound(v, field, rule));
  }
  if (Array.isArray(node)) return node.some((v) => pairFound(v, field, rule));
  return false;
}

/**
 * An envelope with the values taken out: every key path and the type at it.
 *
 * Not part of the judgement, which the schema makes. This is what a failure prints, so a
 * reader is told what the framework actually answered rather than only that it did not
 * match.
 */
export function shapeOf(node: unknown, path = ""): Set<string> {
  if (isObject(node)) {
    const keys = Object.keys(node);
    if (keys.length === 0) return new Set([`${path}{}`]);
    const out = new Set<string>();
    for (const key of keys) {
      for (const s of shapeOf(node[key], (path ? `${path}.` : "") + key)) out.add(s);
    }
    return out;
  }
  if (Array.isArray(node)) {
    if (node.length === 0) return new Set([`${path}[]`]);
    const out = new Set<string>();
    for (const v of node) for (const s of shapeOf(v, `${path}[]`)) out.add(s);
    return out;
  }
  const kind =
    node === null ? "null"
    : typeof node === "string" ? "string"
    : typeof node === "boolean" ? "bool"
    : typeof node === "number" ? "number"
    : "other";
  return new Set([`${path}:${kind}`]);
}

// ---- the pieces a framework's contract is built from ---------------------------------

const statusIn = (statuses: readonly number[]): z.ZodType<number> =>
  z.number().int().superRefine((s, ctx) => {
    if (!statuses.includes(s)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `expected ${statuses.join(" or ")}, got ${s}`,
      });
    }
  });

/**
 * What a framework answers where its own facility does not answer what the endpoint declares.
 *
 * Every field is the framework's statement about itself, replacing the endpoint's default
 * rather than relaxing it. Gin's `ShouldBindJSON` answers 400 where the endpoint says 422;
 * Hibernate Validator writes "must not be blank" where the endpoint says `required`. Both are
 * the framework working correctly, and the point of #35 is to measure that rather than a
 * handler translating it back.
 */
export type Divergence = {
  /** The statuses this framework answers here. */
  readonly statuses?: readonly number[];
  /**
   * How this framework names the endpoint's field errors, in its own vocabulary.
   *
   * An empty list drops the check, which is only right when `body` names the fields itself:
   * an `errors` object with the three keys, declared strictly, says more than pairFound can.
   */
  readonly fieldErrors?: readonly (readonly [string, string])[];
  /** What kind of body this framework sends here, where it is not JSON. */
  readonly bodyClass?: string;
};

/**
 * A complete answer: the status, a body of the shape this framework declares, and the field
 * errors it reports, found wherever it put them.
 *
 * This is what every exception package returns. A framework states its envelope as `body`
 * and takes the rest from the endpoint, or says in `instead` where it answers differently.
 */
export function errorEnvelope(
  ask: Ask, body: z.ZodType<unknown>, instead: Divergence = {},
): z.ZodType<unknown> {
  const pairs = instead.fieldErrors ?? ask.fieldErrors;
  const reported = body.superRefine((value, ctx) => {
    for (const [field, rule] of pairs) {
      if (!pairFound(value, field, rule)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `does not report ${field}=${rule}`,
        });
      }
    }
  });
  return z.object({
    status: statusIn(instead.statuses ?? ask.statuses),
    body_class: z.literal(instead.bodyClass ?? "json"),
    encoding: z.string(),
    body: reported,
  });
}

/**
 * RFC 7807, which is what every .NET framework here and Spring's ProblemDetail answer.
 *
 * `errors` is the validation map, absent on the endpoints that carry no field errors.
 * `traceId` is present per connection and absent when tracing is off, so it is optional
 * rather than pinned; nothing else about the envelope is left open.
 */
export function problemDetails(extra: z.ZodRawShape = {}): z.ZodType<unknown> {
  return z
    .object({
      type: z.string(),
      title: z.string().min(1),
      status: z.number().int(),
      traceId: z.string().optional(),
      ...extra,
    })
    .strict();
}

/** The validation map both ProblemDetails and the FluentValidation lists carry. */
export const fieldErrorMap = z.record(z.string(), z.array(z.string()).min(1));

// ---- the envelope every target still on the shared validator answers ------------------

/**
 * What a target answers while it still calls the shared validator in `_shared/domain`.
 *
 * One envelope for every language, which is the defect #35 describes rather than a property
 * worth keeping. A framework moving to its own validation facility replaces this call in its
 * own client-exception package and touches nothing else -- including when its facility
 * answers a different status or names the rules differently, which it says through the
 * `instead` argument to errorEnvelope.
 */
export function sharedValidatorEnvelope(target: string): ExceptionPackage {
  const bare = z.object({ error: z.string().min(1) }).strict();
  const validation = z
    .object({
      error: z.string().min(1),
      errors: z
        .array(z.object({ field: z.string(), rule: z.string() }).strict())
        .min(1),
    })
    .strict();
  const envelope = (body: z.ZodType<unknown>) => (ask: Ask) => errorEnvelope(ask, body);
  return {
    target,
    because:
      "Still validates by calling the shared validator in _shared/domain, so it answers " +
      "this repository's envelope rather than its own. See issue #35.",
    schemas: {
      "authorized.denied": envelope(bare),
      "errors.not_found": envelope(bare),
      "errors.unmatched": envelope(bare),
      "body.rejected_all": envelope(validation),
      "body.rejected_first": envelope(validation),
      "errors.malformed": envelope(validation),
    },
  };
}

/**
 * The Ask for one endpoint, without a plan to derive it from.
 *
 * For a package's own tests. The client builds the real one from spec/plan.json.
 */
export const askIn = (
  target: string,
  endpoint: string,
  statuses: readonly number[],
  fieldErrors: readonly (readonly [string, string])[] = [],
): Ask => ({
  target, endpoint, family: endpoint.split(".")[0] ?? "", method: "POST",
  path: "/body/validate/small", statuses, fieldErrors,
});

// ---- reporting -----------------------------------------------------------------------

/**
 * Why an answer does not satisfy the schema, as one line.
 *
 * The first issue only. An envelope that changed usually produces one issue per key, and
 * listing them all buries the one that says what happened.
 */
export function explain(error: z.ZodError, answer: Answer): string {
  const issue = error.issues[0];
  if (!issue) return "does not match the declared envelope";
  const where = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
  const shape = [...shapeOf(answer.body)].sort().join(", ");
  return `${where}${issue.message} (answered ${shape || "an empty body"})`;
}
