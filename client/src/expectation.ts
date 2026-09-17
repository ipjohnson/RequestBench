// The other authority: what a target answered against spec/expected.json.
//
// Ported from tests/. There is one thing this refuses to do, and it is the reason it exists
// separately from the gate: it never compares a target against another target. The committed
// expectation is the authority, and a target that disagrees with it fails however many other
// targets share the mistake.
//
// The exception is an error endpoint. An envelope is the framework's own contract, so there
// the authority is the schema that framework declared in its own client-exception package.
import { firstDifference } from "./compare.js";
import { errorProblem } from "./exceptions.js";
import { Replay, answerOf, type Visit } from "./replay.js";
import {
  askFor, keysOf, type Expected, type ExpectedRequest, type Plan, type PlanEndpoint,
} from "./spec.js";
import type { Encoding } from "./checks.js";
import type { Answer } from "@rb/schema";

export type EndpointVerdict = {
  readonly id: string;
  readonly ok: boolean;
  /** How many of this endpoint's distinct requests were answered wrongly. */
  readonly wrong: number;
  readonly total: number;
  /** One line per distinct complaint, in first-seen order. */
  readonly problems: readonly string[];
};

export type ExpectationResult = {
  readonly endpoints: readonly EndpointVerdict[];
  readonly sent: number;
  readonly meta: Record<string, unknown>;
};

export type ExpectationOptions = {
  readonly instances?: number;
  readonly encoding?: Encoding;
  readonly onEndpoint?: (v: EndpointVerdict) => void;
};

/**
 * Why one request's answer is not the expected one, or null.
 *
 * Status first, then the kind of body, then the body itself. A target answering the right
 * values with the wrong content-type is not answering correctly, and checking the body first
 * would report that as a pass.
 */
export function difference(want: ExpectedRequest, got: Answer): string | null {
  if (got.status !== want.status) return `expected ${want.status}, got ${got.status}`;
  // A null expectation is a field spec/expected.json deliberately does not pin; its
  // "unpinned" block says which, and what each contributor answered there. body_class is
  // one on a status that carries no body, where RFC 9110 15.4.5 leaves the headers around
  // the absent body to the sender and the frameworks disagree.
  if (want.body_class !== null && got.body_class !== want.body_class) {
    return `expected a ${want.body_class} body, got ${got.body_class}`;
  }
  if (want.encoding !== null && got.encoding !== want.encoding) {
    return `expected content-encoding ${want.encoding || "identity"}, `
      + `got ${got.encoding || "identity"}`;
  }
  return firstDifference(got.body, want.body);
}

/** Every distinct complaint about one endpoint, in first-seen order. */
function distinct(problems: readonly string[]): string[] {
  return [...new Set(problems)];
}

export async function check(
  plan: Plan, expected: Expected, hostport: string, target: string,
  opts: ExpectationOptions = {},
): Promise<ExpectationResult> {
  const run = new Replay(plan, hostport, {
    ...(opts.instances === undefined ? {} : { instances: opts.instances }),
    ...(opts.encoding === undefined ? {} : { encoding: opts.encoding }),
    distinct: true,
  });
  const meta = await run.meta();
  const endpoints: EndpointVerdict[] = [];
  let sent = 0;

  for await (const { ep, visits, why } of run.endpoints()) {
    const answered = new Map(visits.map((v) => [`${ep.id} ${v.path}`, v]));
    sent += visits.length;
    // A capture the target would not give up. Nothing was sent, so there is nothing to
    // compare, and calling that a pass would be worse than calling it a failure.
    const problems = why ? [why]
      : ep.id in expected.errors
        ? errorProblems(ep, target, answered)
        : requestProblems(ep, expected, answered);
    const verdict: EndpointVerdict = {
      id: ep.id,
      ok: problems.length === 0,
      wrong: problems.length,
      total: keysOf(ep).length,
      problems: distinct(problems.map(stripKey)),
    };
    endpoints.push(verdict);
    opts.onEndpoint?.(verdict);
  }

  run.close();
  return { endpoints, sent, meta };
}

/** The complaint without the request key, so 512 identical failures collapse to one line. */
const stripKey = (problem: string): string => {
  const at = problem.indexOf(": ");
  return at === -1 ? problem : problem.slice(at + 2);
};

function errorProblems(
  ep: PlanEndpoint, target: string, answered: ReadonlyMap<string, Visit>,
): string[] {
  const out: string[] = [];
  for (const key of keysOf(ep)) {
    const visit = answered.get(key);
    if (!visit) { out.push(`${key}: the target was never asked`); continue; }
    const why = errorProblem(askFor(target, ep, visit.path), answerOf(visit));
    if (why) out.push(`${key}: ${why}`);
  }
  return out;
}

function requestProblems(
  ep: PlanEndpoint, expected: Expected, answered: ReadonlyMap<string, Visit>,
): string[] {
  const keys = keysOf(ep);
  const missing = keys.filter((k) => !(k in expected.requests));
  if (missing.length > 0) {
    // Not a target failure. The expectation does not describe this endpoint, so nothing here
    // can say whether the target is right, and reporting it as a pass would be worse.
    return [`${missing[0]}: spec/expected.json says nothing about `
      + `${missing.length} request(s) of ${ep.id}`];
  }
  const out: string[] = [];
  for (const key of keys) {
    const visit = answered.get(key);
    if (!visit) { out.push(`${key}: the target was never asked`); continue; }
    const why = difference(expected.requests[key] as ExpectedRequest, answerOf(visit));
    if (why) out.push(`${key}: ${why}`);
  }
  return out;
}
