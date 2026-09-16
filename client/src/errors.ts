// Error envelopes, which are the framework's contract rather than this repository's.
//
// Ported from harness/expected.py. A 2xx body is the controlled variable and is pinned
// exactly. An error body is not: what is required is the status, that the body is JSON,
// and that each declared field/rule pair is reported somewhere inside it, in whatever
// shape the framework produces.
import type { ErrorExpectation, Envelope } from "./spec.js";

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Every string in a subtree, keys and values alike. */
function stringsOf(node: unknown): Set<string> {
  if (isObject(node)) {
    const out = new Set(Object.keys(node));
    for (const v of Object.values(node)) for (const s of stringsOf(v)) out.add(s);
    return out;
  }
  if (Array.isArray(node)) {
    const out = new Set<string>();
    for (const v of node) for (const s of stringsOf(v)) out.add(s);
    return out;
  }
  return typeof node === "string" ? new Set([node]) : new Set();
}

/**
 * Whether a field error is reported somewhere in this body, in either shape anyone uses.
 *
 * Two shapes, because those are the two anyone writes. An object carrying both as values
 * is this repository's own {"field": ..., "rule": ...}; a key equal to the field whose
 * subtree names the rule is what ProblemDetails and the FluentValidation-shaped lists
 * produce. Anything else fails, which is the right outcome: a third shape is worth looking
 * at rather than pattern-matching blind.
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
 * An error envelope with the values taken out: every key path and the type at it.
 *
 * What is held still is the shape, not the contents. ASP.NET's ProblemDetails carries a
 * traceId that changes per connection, so an exact body could never match twice; a key
 * appearing, disappearing or changing type is what a changed envelope actually is.
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

/** What a capture looks like for one request, before it is judged. */
export type Answer = {
  readonly status: number;
  readonly body_class: string;
  readonly encoding: string;
  readonly body: unknown;
};

/** What is recorded for one target's error response. */
export const envelopeOf = (answer: Answer): Envelope => ({
  status: answer.status,
  body_class: answer.body_class,
  shape: [...shapeOf(answer.body)].sort(),
});

/** Python's truthiness for a parsed JSON body, which is what "empty" means here. */
function isEmpty(body: unknown): boolean {
  if (body === null || body === undefined) return true;
  if (typeof body === "string") return body.length === 0;
  if (typeof body === "number") return body === 0;
  if (typeof body === "boolean") return !body;
  if (Array.isArray(body)) return body.length === 0;
  if (isObject(body)) return Object.keys(body).length === 0;
  return false;
}

/** Why an error body is not acceptable, however the framework shaped it. */
export function contentProblems(spec: ErrorExpectation, answer: Answer): string[] {
  if (answer.body_class !== "json") return [`body is ${answer.body_class}, not json`];
  if (isEmpty(answer.body)) return ["body is empty"];
  return spec.field_errors
    .filter(([f, r]) => !pairFound(answer.body, f, r))
    .map(([f, r]) => `does not report ${f}=${r}`);
}
