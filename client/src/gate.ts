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
  advanced, cacheKeyOf, canProveFreshness, checkHeaders, decoded, framing, headerBytes,
  isFreshnessChecked, isReplayChecked, repeated, serialOf, type Encoding, type Header,
} from "./checks.js";
import { askFor, isError, keysOf, statusesOf, type Plan, type PlanEndpoint } from "./spec.js";
import { errorProblem } from "./exceptions.js";
import { Replay, answerOf } from "./replay.js";

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
  const run = new Replay(plan, hostport, {
    ...(opts.instances === undefined ? {} : { instances: opts.instances }),
    encoding,
  });
  const responses: Record<string, Comparable> = {};
  const headerProblems: [string, string][] = [];
  const exemplars: Exemplar[] = [];
  const drift: [string, string][] = [];
  const results: EndpointResult[] = [];
  const seenOnce = new Set<string>();
  let sent = 0, compared = 0;

  const meta = await run.meta();

  for await (const { ep, visits, why: unsendable } of run.endpoints()) {
    const body = ep.body;
    // What the endpoint declares. On an error endpoint this is the default the framework's
    // package starts from rather than what the gate enforces; see `accepts` below.
    const allowed = new Set(statusesOf(ep));
    // Two opposite readings of one counter. On every other family a stored response is a
    // fault and the serial has to advance; on the cache family a stored response is the
    // feature and the serial has to repeat, per key, for as long as the entry lives.
    const fresh = isFreshnessChecked(ep.id) && !opts.skipHeaders;
    const replayed = isReplayChecked(ep.id) && !opts.skipHeaders;
    /** The serial each distinct cache key answered with the first time it was asked. */
    const stored = new Map<string, number>();
    /**
     * Whether a replayed response has had its headers checked yet.
     *
     * The check below runs once per endpoint, on the first response that arrived, and on a
     * cache row that response is the one the handler built. What a store writes back is a
     * different response, and the two can disagree: Sanic writes the content type from the
     * response object rather than from the header map, so a replay built from the headers
     * alone went out as application/octet-stream and a cold store hid it.
     */
    let replayChecked = opts.skipHeaders ?? false;
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

    for (const visit of visits) {
      const { path, status, raw, headers: hdrs } = visit;
      if (visit.transportError !== null) bad ??= visit.transportError;
      sent++;
      seen.set(status, (seen.get(status) ?? 0) + 1);
      if (!accepts(status) && bad === null) {
        bad = `expected ${[...allowed].sort((a, b) => a - b).join("/")}, got ${status} on ${path}`;
      }
      // Only a response that actually arrived with the right status may define the
      // endpoint's comparison; otherwise a single early hiccup gets recorded as the
      // reference body and every later comparison reports drift that is not real.
      if (fresh && accepts(status) && canProveFreshness(status)) {
        stale ??= advanced(hdrs, lastSerial);
        lastSerial = serialOf(hdrs, lastSerial);
      }
      if (replayed && accepts(status)) {
        const key = cacheKeyOf(visit.path, visit.sent);
        const first = stored.get(key);
        stale ??= repeated(hdrs, first ?? null);
        const got = serialOf(hdrs, null);
        if (first === undefined && got !== null) stored.set(key, got);
        else if (!replayChecked) {
          replayChecked = true;
          for (const msg of checkHeaders(status, hdrs, raw, encoding)) {
            headerProblems.push([ep.id, `replayed: ${msg}`]);
          }
        }
      }
      // Every instance, not just the first of each path: a framework that answers a
      // different envelope once it has warmed up is exactly what this is here to catch, and
      // parsing a three-key error body costs nothing next to the request that fetched it.
      if (carriesError && accepts(status)) {
        envelope ??= errorProblem(askFor(target, ep, path), answerOf(visit));
      }
      if (accepts(status)) {
        const key = `${ep.id} ${path}`;
        if (!(key in responses)) responses[key] = comparable(decoded(raw, hdrs), visit.contentType);
        if (!seenOnce.has(ep.id)) {
          seenOnce.add(ep.id);
          if (!opts.skipHeaders) {
            for (const msg of checkHeaders(status, hdrs, raw, encoding)) headerProblems.push([ep.id, msg]);
          }
          exemplars.push({
            endpoint: ep.id, family: ep.family,
            request: {
              method: ep.method, path,
              headers: Object.entries(visit.sent).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
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

    // Every distinct key the plan sent has to have its own stored response. A store that
    // ignores a vary header answers one of them for several keys, which passes the
    // per-key comparison above -- the requests sharing a key here shared one there too --
    // and shows up only as fewer distinct serials than keys asked.
    if (replayed && stale === null) {
      const distinct = new Set(stored.values()).size;
      if (stored.size > 0 && distinct !== stored.size) {
        stale = `${stored.size} distinct cache key(s) sent, ${distinct} stored response(s) `
          + "answered (the store is not keyed on everything the row varies)";
      }
    }
    const instances = visits.length;
    const ok = unsendable === null && [...seen.keys()].every(accepts) && seen.size === 1
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
      id: ep.id, method: ep.method, instances, ok, seen,
      why: ok ? null
        : (unsendable ?? bad ?? stale ?? envelope ?? `mixed statuses ${dictRepr(seen)}`),
      drift: note,
    };
    results.push(result);
    opts.onEndpoint?.(result);
  }

  run.close();
  return { endpoints: results, responses, headerProblems, exemplars, drift, sent, compared, meta };
}

/** Python's dict repr, so the two implementations' output can be diffed while both exist. */
export const dictRepr = (m: ReadonlyMap<number, number>): string =>
  `{${[...m].map(([k, v]) => `${k}: ${v}`).join(", ")}}`;
