// The gate: the whole corpus, put to one running framework through the validating client, with
// every assertion checked. A framework that fails a performance row is not measured, because a
// wrong answer makes its latency describe something else. A failing validation test is reported
// and fails CI, and stops nothing here.
//
// Each test gets a session of its own and is sent twice on it, as corpus.test.ts does, because
// fresh() and replayed() are claims about two answers. The draws are fixed, so the second send
// asks for exactly what the first did and a replay has something to replay.
import { gunzipSync } from "node:zlib";

import type { Draw, Exceptions, Framework, RunValues, Suite, Test } from "@rb/tests/kit";
import type { LambdaFraming } from "../traffic-generator/pipe.ts";
import type { Exchange } from "./live.ts";
import { validator, type Transport } from "./validate.ts";

export type Outcome =
  | { readonly status: "passed" }
  | { readonly status: "failed"; readonly failures: readonly string[] }
  | { readonly status: "skipped"; readonly reason: string }
  /** Listed under the host's `unsupported` in rb.json, so it was never sent. */
  | { readonly status: "unsupported"; readonly reason: string }
  | { readonly status: "notAsked" }
  | { readonly status: "unrun" };

export interface GateResult {
  /** By test id, performance tests first, each group in id order. */
  readonly outcomes: Readonly<Record<string, Outcome>>;
  /** No performance row failed, so the framework may be measured. */
  readonly measurable: boolean;
  /** Nothing failed that is not skipped, so CI passes. */
  readonly passed: boolean;
  /** The last exchange of each test's first send, which is the call the test is about. */
  readonly exchanges: ReadonlyMap<string, Exchange>;
}

/** The same picks every time, so a failure reproduces and the second send repeats the first. */
export const FIXED_DRAW: Draw = {
  choice: <T>(values: readonly T[]) => values[0] as T,
  item: () => 17,
};

/** Values of the shape a run draws, for a gate that is not part of a run. */
export const FIXED_VALUES: RunValues = {
  one: 4821,
  two: 7390,
  tenant: "qwertyuiopas",
  requestId: "0123456789abcdef",
  account: 482913,
  page: 417,
  size: 38,
  status: "paid",
  category: "garden",
  sort: "created",
  q: "alpha bravo",
  minPrice: 1200,
  maxPrice: 34000,
};

export interface GateInput {
  readonly suite: Suite;
  readonly transport: Transport;
  readonly exceptions: Exceptions;
  /** The framework as its rb.json declares it, which a scoped test reads. Absent: nothing is scoped out. */
  readonly declared?: Framework | undefined;
  readonly skips?: Readonly<Record<string, string>> | undefined;
  /** Tests the framework cannot answer on the host being gated, by id, each with the reason. */
  readonly unsupported?: Readonly<Record<string, string>> | undefined;
  readonly run: RunValues;
  /**
   * Whether the framework is still up, asked when a call fails to get an answer. Once it is
   * not, every test after the one that found out is reported unrun rather than failed, so the
   * report blames the test that stopped it and not the ones that never had a chance.
   */
  readonly alive: () => Promise<boolean>;
  /** Wired to the transport's onExchange by whoever built the transport. */
  readonly exchanges?: { current: Exchange[] };
}

const idOfTest = (t: Test) => `${t.id.family}.${t.id.name}`;

export async function gate(input: GateInput): Promise<GateResult> {
  const tests = Object.values(input.suite.tests);
  const ordered = [
    ...tests.filter((t) => t.kind === "performance").sort((a, b) => (idOfTest(a) < idOfTest(b) ? -1 : 1)),
    ...tests.filter((t) => t.kind === "validation").sort((a, b) => (idOfTest(a) < idOfTest(b) ? -1 : 1)),
  ];
  const outcomes: Record<string, Outcome> = {};
  const exchanges = new Map<string, Exchange>();
  let down = false;

  for (const test of ordered) {
    const id = idOfTest(test);
    const unsupported = input.unsupported?.[id];
    if (unsupported !== undefined) {
      outcomes[id] = { status: "unsupported", reason: unsupported };
      continue;
    }
    if (down) {
      outcomes[id] = { status: "unrun" };
      continue;
    }
    const reason = input.skips?.[id];
    if (test.kind === "validation" && reason !== undefined) {
      outcomes[id] = { status: "skipped", reason };
      continue;
    }
    if (test.kind === "validation" && test.scope !== undefined && input.declared !== undefined && !test.scope(input.declared)) {
      outcomes[id] = { status: "notAsked" };
      continue;
    }

    const session = validator({ transport: input.transport, exceptions: input.exceptions, run: input.run, draw: FIXED_DRAW });
    const failures: string[] = [];
    try {
      if (input.exchanges) input.exchanges.current = [];
      await test.request(session.client);
      const first = input.exchanges?.current.at(-1);
      if (first !== undefined) exchanges.set(id, first);
      await test.request(session.client);
    } catch (error) {
      failures.push((error as Error).message);
      if (!(await input.alive())) down = true;
    }
    failures.push(...session.failures.map((f) => `${f.kind}: ${f.message}`));
    if (session.unsent() > 0) failures.push("a call was built and never sent");
    outcomes[id] = failures.length === 0 ? { status: "passed" } : { status: "failed", failures };
  }

  const failed = (kind: Test["kind"]) => ordered.some((t) => t.kind === kind && outcomes[idOfTest(t)]!.status === "failed");
  const unrun = Object.values(outcomes).some((o) => o.status === "unrun");
  return {
    outcomes,
    measurable: !failed("performance") && !unrun,
    passed: !failed("performance") && !failed("validation") && !unrun,
    exchanges,
  };
}

// ---- exemplars ---------------------------------------------------------------------------

/** One request and its answer, as a reader of the framework page sees them. */
export interface Exemplar {
  readonly request: {
    readonly method: string;
    readonly target: string;
    readonly headers: readonly (readonly [string, string])[];
    readonly bodyBytes: number;
    readonly body?: string;
  };
  readonly response: {
    readonly status: number;
    /** Lower-case names, in the order the framework wrote them. */
    readonly headers: readonly (readonly [string, string])[];
    /**
     * Over HTTP/1.1, the status line, every header line and the blank line after them. Over
     * HTTP/2, the field section's size as RFC 9113 counts it against SETTINGS_MAX_HEADER_LIST_SIZE:
     * each name and value and 32 more, :status included. On the Lambda Runtime API, what the
     * function posted to /response besides the body: a proxy response's JSON around it, or a
     * stream's prelude and the eight NUL bytes after it.
     */
    readonly headerBytes: number;
    /**
     * How the body's end was marked: content-length, chunked or close over HTTP/1.1, frames over
     * HTTP/2, where END_STREAM marks it, or none for a body that cannot have one. On the Lambda
     * Runtime API, how the function framed its answer instead.
     */
    readonly framing: "content-length" | "chunked" | "close" | "frames" | "none" | LambdaFraming;
    /** As it went over the wire, with any content coding still on. */
    readonly bodyBytes: number;
    /** The start of the body with its content coding undone. */
    readonly body: string;
    readonly truncated: boolean;
  };
}

/** Enough of a body to recognise it, which is all a page shows. */
const EXCERPT = 2048;

/**
 * Headers whose values change from one capture to the next without the framework changing.
 * Their names stay, so a page still shows that the framework sends them, and the file only
 * shows a diff when something about the framework moved.
 */
const VOLATILE = new Set(["date", "last-modified", "expires", "age"]);

/**
 * What stands in for the Host header the request carried, wherever the answer repeats it. An
 * absolute URL on the host the request named, such as a Location, is a valid answer, and the port
 * the validator reaches a container on changes from one capture to the next.
 */
const REQUEST_HOST = "<request host>";

const excerpt = (text: string) => (text.length > EXCERPT ? text.slice(0, EXCERPT) : text);

function framingOf(e: Exchange, headers: ReadonlyMap<string, string>): Exemplar["response"]["framing"] {
  if (e.response.lambda !== undefined) return e.response.lambda.framing;
  const bodiless = e.request.method === "HEAD" || e.response.status === 204 || e.response.status === 304;
  if (e.response.httpVersion === "2") return bodiless ? "none" : "frames";
  if ((headers.get("transfer-encoding") ?? "").toLowerCase().includes("chunked")) return "chunked";
  if (headers.has("content-length")) return "content-length";
  if (e.request.method === "HEAD" || e.response.status === 204 || e.response.status === 304) return "none";
  return "close";
}

export function exemplarOf(e: Exchange): Exemplar {
  const res = e.response;
  const headers = new Map(res.rawHeaders.map(([k, v]) => [k.toLowerCase(), v]));
  const headerBytes =
    res.lambda !== undefined
      ? res.lambda.payloadBytes - res.body.length
      : res.httpVersion === "2"
        ? res.rawHeaders.reduce((sum, [k, v]) => sum + Buffer.byteLength(k) + Buffer.byteLength(v) + 32, ":status".length + 3 + 32)
        : Buffer.byteLength(`HTTP/${res.httpVersion} ${res.status} ${res.statusMessage}\r\n`) +
          res.rawHeaders.reduce((sum, [k, v]) => sum + Buffer.byteLength(`${k}: ${v}\r\n`), 0) +
          2;
  let decoded = res.body;
  if ((headers.get("content-encoding") ?? "").includes("gzip") && decoded.length > 0) {
    try {
      decoded = gunzipSync(decoded);
    } catch {
      // A coding that does not decode is shown as it came. The gate has already said so.
    }
  }
  const masked = (value: string) => (e.hostHeader === "" ? value : value.replaceAll(e.hostHeader, REQUEST_HOST));
  const text = masked(decoded.toString("utf8"));
  const requestBody = e.request.body;
  return {
    request: {
      method: e.request.method,
      target: e.request.target,
      headers: Object.entries(e.request.headers),
      bodyBytes: requestBody === undefined ? 0 : Buffer.byteLength(requestBody),
      ...(requestBody === undefined ? {} : { body: excerpt(requestBody) }),
    },
    response: {
      status: res.status,
      headers: res.rawHeaders.map(([k, v]) => [k.toLowerCase(), VOLATILE.has(k.toLowerCase()) ? "<varies>" : masked(v)] as const),
      headerBytes,
      framing: framingOf(e, headers),
      bodyBytes: res.body.length,
      body: excerpt(text),
      truncated: text.length > EXCERPT,
    },
  };
}

/** One framework's exemplars on one host, keyed by test id, as results/exemplars holds them. */
export function exemplarFile(framework: string, host: string, exchanges: ReadonlyMap<string, Exchange>) {
  const tests: Record<string, Exemplar> = {};
  for (const id of [...exchanges.keys()].sort()) tests[id] = exemplarOf(exchanges.get(id)!);
  return { framework, host, tests };
}
