// The committed spec: the plan every target replays, and what a correct answer is.
//
// Ported from harness/plan.py's consumers and harness/expected.py.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Ask } from "@rb/schema";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SPEC = join(ROOT, "spec");

export type PlanEndpoint = {
  readonly id: string;
  readonly family: string;
  readonly method: string;
  readonly expect: number;
  readonly paths: readonly string[];
  readonly accepts?: readonly number[];
  /** What the validator reports for the body being sent, wherever the framework puts it. */
  readonly field_errors?: readonly (readonly [string, string])[];
  readonly body?: string;
  readonly headers?: Readonly<Record<string, string>>;
};

export type Plan = {
  readonly version: string;
  readonly instances: number;
  readonly endpoints: readonly PlanEndpoint[];
};

/** What a non-error request must answer, pinned exactly. */
export type ExpectedRequest = {
  readonly status: number;
  readonly body_class: string;
  /** null where the field is deliberately not pinned; see the `unpinned` block. */
  readonly encoding: string | null;
  readonly body: unknown;
};

/**
 * What an error request must answer, however the framework shaped it.
 *
 * The body is not pinned. A 2xx body is the controlled variable; an error envelope is the
 * framework's own contract, so what is required is the status and that each field/rule
 * pair is reported somewhere inside it.
 */
export type ErrorExpectation = {
  readonly statuses: readonly number[];
  readonly field_errors: readonly (readonly [string, string])[];
};

/** One target's recorded error envelope: the shape, with the values taken out. */
export type Envelope = {
  readonly status: number;
  readonly body_class: string;
  readonly shape: readonly string[];
};

export type Expected = {
  readonly version: string;
  readonly blend: string;
  readonly plan: string;
  readonly fixture: string;
  readonly agreed_by: readonly string[];
  readonly unpinned: Readonly<Record<string, Record<string, string>>>;
  readonly errors: Readonly<Record<string, ErrorExpectation>>;
  readonly requests: Readonly<Record<string, ExpectedRequest>>;
  readonly targets: Readonly<Record<string, Record<string, Envelope>>>;
};

const read = <T,>(name: string): T => JSON.parse(readFileSync(join(SPEC, name), "utf8")) as T;

export const loadPlan = (): Plan => read<Plan>("plan.json");

const digest = (name: string): string =>
  "sha256:" + createHash("sha256").update(readFileSync(join(SPEC, name))).digest("hex");

/**
 * Every distinct request in the plan, as one key.
 *
 * The instances of an endpoint are different requests: /domain/orders/602 and
 * /domain/orders/876 return different orders, so one expectation per endpoint could only
 * ever describe the first of them.
 */
export const keysOf = (ep: PlanEndpoint): string[] =>
  [...new Set(ep.paths)].map((p) => `${ep.id} ${p}`);

export const statusesOf = (ep: PlanEndpoint): number[] => [...(ep.accepts ?? [ep.expect])];

/**
 * Whether this endpoint answers with an error body.
 *
 * Derived from the status rather than declared: an endpoint expecting 400 or above carries
 * one.
 */
export const isError = (ep: PlanEndpoint): boolean => Math.max(...statusesOf(ep)) >= 400;

/**
 * What one framework's client-exception package is told about one request.
 *
 * Built here rather than at each call site so the gate and the tests ask the same question.
 */
export const askFor = (target: string, ep: PlanEndpoint, path: string): Ask => ({
  target, endpoint: ep.id, family: ep.family, method: ep.method, path,
  statuses: statusesOf(ep), fieldErrors: ep.field_errors ?? [],
});

/** Whether the committed expectation describes the plan and fixture now on disk. */
export function staleAgainstSpec(plan: Plan): string | null {
  let doc: Expected;
  try {
    doc = read<Expected>("expected.json");
  } catch {
    return "spec/expected.json does not exist";
  }
  for (const name of ["plan", "fixture"] as const) {
    if (doc[name] !== digest(`${name}.json`)) {
      return `spec/expected.json was taken against a different spec/${name}.json`;
    }
  }
  if (doc.blend !== plan.version) {
    return `spec/expected.json is ${doc.blend}, the plan is ${plan.version}`;
  }
  return null;
}

/** The committed expectation, or a clear reason it cannot be used. */
export function loadExpected(plan: Plan): Expected {
  const why = staleAgainstSpec(plan);
  if (why) throw new Error(`${why}; run 'make expected'`);
  return read<Expected>("expected.json");
}
