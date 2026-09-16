// The gate. A target is not measured until it passes.
//
// Ported from harness/conform.py. Replays every instance in spec/plan.json against one
// running target and asserts the status, the response header contract, and x-rb-serial
// freshness on the families that carry it.
//
// One thing the Python does not do: an error endpoint is judged against the contract the
// framework declared for itself, not against the reference target. Two frameworks answering
// their own envelopes is the point of the endpoint set, and comparing them reported it as
// drift.
import { comparable, firstDifference, type Comparable } from "./compare.js";
import {
  advanced, bodyClass, checkHeaders, contentEncoding, decoded, framing, headerBytes,
  isFreshnessChecked, serialOf, type Encoding, type Header,
} from "./checks.js";
import { askFor, isError, keysOf, statusesOf, type Plan, type PlanEndpoint } from "./spec.js";
import { errorProblem } from "./exceptions.js";
import { Transport, type Reply } from "./http.js";

const EMPTY = Buffer.alloc(0);

export type Exemplar = {
  endpoint: string; family: string;
  request: { method: string; path: string; headers: [string, string][]; body: string | null; body_bytes: number };
  response: {
    status: number; headers: readonly Header[]; header_bytes: number; framing: string;
    body_bytes: number; body: string; truncated: boolean;
  };
};

export type EndpointResult = {
  readonly id: string; readonly method: string; readonly instances: number;
  readonly ok: boolean;
  /** status -> how many instances answered it, in first-seen order. */
  readonly seen: ReadonlyMap<number, number>;
  readonly why: string | null;
  readonly drift: string | null;
};

export type GateResult = {
  readonly endpoints: readonly EndpointResult[];
  readonly responses: Record<string, Comparable>;
  readonly headerProblems: readonly (readonly [string, string])[];
  readonly exemplars: readonly Exemplar[];
  readonly drift: readonly (readonly [string, string])[];
  readonly sent: number;
  readonly compared: number;
  readonly meta: Record<string, unknown>;
};

export type GateOptions = {
  readonly instances?: number;          // 0 or absent = every instance
  readonly encoding?: Encoding;
  readonly skipHeaders?: boolean;
  readonly reference?: Record<string, Comparable> | null;
  readonly onEndpoint?: (r: EndpointResult) => void;
};

const requestHeaders = (ep: PlanEndpoint): Record<string, string> => {
  // The same request gen/blend.mjs sends: the endpoint's own headers, plus a content-type
  // when there is a body. The gate used to add an accept the generator never sends, which
  // meant a content-negotiating target could be gated on one response and measured on
  // another.
  const headers: Record<string, string> = { ...(ep.headers ?? {}) };
  if (ep.body) headers["content-type"] = "application/json";
  return headers;
};

/**
 * Replay the plan against one running target and say whether it conforms.
 *
 * `target` is "node:fastify" and is required, because an error endpoint is judged against the
 * contract that framework declared in its own client-exception package. A gate that did not
 * know which target it was talking to could only fall back to accepting any JSON.
 */
export async function gate(
  plan: Plan, hostport: string, target: string, opts: GateOptions = {},
): Promise<GateResult> {
  const encoding = opts.encoding ?? "http";
  const conn = new Transport(hostport, encoding);
  const responses: Record<string, Comparable> = {};
  const headerProblems: [string, string][] = [];
  const exemplars: Exemplar[] = [];
  const drift: [string, string][] = [];
  const results: EndpointResult[] = [];
  const seenOnce = new Set<string>();
  let sent = 0, compared = 0;

  let meta: Record<string, unknown> = {};
  try {
    const r = await conn.send("GET", "/__meta", undefined, {});
    meta = JSON.parse(r.body.toString("utf8")) as Record<string, unknown>;
  } catch {
    conn.reset();
  }

  for (const ep of plan.endpoints) {
    const paths = opts.instances ? ep.paths.slice(0, opts.instances) : ep.paths;
    const body = ep.body;
    const headers = requestHeaders(ep);
    // What the endpoint declares. On an error endpoint this is the default the framework's
    // package starts from rather than what the gate enforces; see `accepts` below.
    const allowed = new Set(statusesOf(ep));
    const fresh = isFreshnessChecked(ep.id) && !opts.skipHeaders;
    // An error envelope is the framework's own contract, so this endpoint's body is judged
    // against the schema the framework declared and never compared against the reference.
    // Two frameworks answering ProblemDetails and an ErrorResponse are not in disagreement,
    // and comparing them field by field reports as drift the one thing the endpoint set
    // deliberately leaves to the framework.
    const carriesError = isError(ep);
    // On an error endpoint the framework's own package is the only authority on the status,
    // because its own facility is what produces it: gin's binding answers 400 where the
    // endpoint declares 422, and that is gin working. The endpoint's declaration is still
    // what the package gets by default, so nothing changes for a framework that says nothing.
    // A status of 0 is a transport failure and is nobody's contract.
    const accepts = (status: number): boolean =>
      carriesError ? status !== 0 : allowed.has(status);
    const seen = new Map<number, number>();
    let bad: string | null = null, stale: string | null = null, lastSerial: number | null = null;
    let envelope: string | null = null;

    for (const path of paths) {
      let reply: Reply | null = null;
      try {
        reply = await conn.send(ep.method, path, body, headers);
      } catch (e) {
        conn.reset();
        bad ??= `transport:${(e as Error).name}`;
      }
      const status = reply?.status ?? 0;
      const raw = reply?.body ?? EMPTY;
      const ctype = reply?.contentType;
      const hdrs: readonly Header[] = reply?.headers ?? [];
      sent++;
      seen.set(status, (seen.get(status) ?? 0) + 1);
      if (!accepts(status) && bad === null) {
        bad = `expected ${[...allowed].sort((a, b) => a - b).join("/")}, got ${status} on ${path}`;
      }
      // Only a response that actually arrived with the right status may define the
      // endpoint's comparison; otherwise a single early hiccup gets recorded as the
      // reference body and every later comparison reports drift that is not real.
      if (fresh && accepts(status)) {
        stale ??= advanced(hdrs, lastSerial);
        lastSerial = serialOf(hdrs, lastSerial);
      }
      // Every instance, not just the first of each path: a framework that answers a
      // different envelope once it has warmed up is exactly what this is here to catch, and
      // parsing a three-key error body costs nothing next to the request that fetched it.
      if (carriesError && accepts(status)) {
        envelope ??= errorProblem(askFor(target, ep, path), {
          status, body_class: bodyClass(ctype), encoding: contentEncoding(hdrs),
          body: comparable(decoded(raw, hdrs), ctype),
        });
      }
      if (accepts(status)) {
        const key = `${ep.id} ${path}`;
        if (!(key in responses)) responses[key] = comparable(decoded(raw, hdrs), ctype);
        if (!seenOnce.has(ep.id)) {
          seenOnce.add(ep.id);
          if (!opts.skipHeaders) {
            for (const msg of checkHeaders(status, hdrs, raw, encoding)) headerProblems.push([ep.id, msg]);
          }
          exemplars.push({
            endpoint: ep.id, family: ep.family,
            request: {
              method: ep.method, path,
              headers: Object.entries(headers).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
              body: body ? body.slice(0, 2048) : null,
              body_bytes: body ? Buffer.byteLength(body, "utf8") : 0,
            },
            response: {
              status, headers: hdrs, header_bytes: headerBytes(hdrs), framing: framing(hdrs),
              body_bytes: raw.length, body: raw.subarray(0, 2048).toString("utf8"),
              truncated: raw.length > 2048,
            },
          });
        }
      }
    }

    const ok = [...seen.keys()].every(accepts) && seen.size === 1
      && stale === null && envelope === null;
    let note: string | null = null;
    if (opts.reference && !carriesError) {
      for (const key of keysOf(ep)) {
        if (!(key in opts.reference) || !(key in responses)) continue;
        compared++;
        const d = firstDifference(responses[key], opts.reference[key]);
        if (d) { note = d; drift.push([ep.id, d]); break; }
      }
    }
    const result: EndpointResult = {
      id: ep.id, method: ep.method, instances: paths.length, ok, seen,
      why: ok ? null : (bad ?? stale ?? envelope ?? `mixed statuses ${dictRepr(seen)}`),
      drift: note,
    };
    results.push(result);
    opts.onEndpoint?.(result);
  }

  conn.close();
  return { endpoints: results, responses, headerProblems, exemplars, drift, sent, compared, meta };
}

/** Python's dict repr, so the two implementations' output can be diffed while both exist. */
export const dictRepr = (m: ReadonlyMap<number, number>): string =>
  `{${[...m].map(([k, v]) => `${k}: ${v}`).join(", ")}}`;
