// What one recorded call sends and what it checks, as the site's tests pages show it.
//
// The request is shown as it goes on the wire, with each drawn value as its placeholder. The
// answer is shown as its checks rather than as bytes, because a test fixes what an answer has
// to satisfy: the status, some headers and the body. The rest of an answer is the framework's
// own, and its error bodies are too.
import type { Json, Payload, RunValues } from "@rb/tests/kit";
import * as published from "@rb/tests/payloads";
import { isPayload } from "./corpus.ts";
import { code, COMPARED, describeMatch, list } from "./openapi.ts";
import { ETAG, placeholders, recorder, sentinelsIn, templateOf, type Assert, type RecordedCall, type Recording } from "./record.ts";

/** Bodies are cut here, as the site cuts a captured exchange. */
export const BODY_LIMIT = 700;

/** A header a call sends. `note` says what the value is when it is not the same on every request. */
export interface SentHeader {
  readonly name: string;
  readonly value: string;
  readonly note?: string;
}

/** A check on one header of the answer. `rule` is prose, with literals in backticks. */
export interface CheckedHeader {
  readonly name: string;
  readonly rule: string;
}

/** The start of a body as it goes on the wire, and the size of all of it. */
export interface BodyView {
  readonly text: string;
  readonly bytes: number;
  readonly truncated: boolean;
}

export interface CallView {
  readonly method: string;
  /** The path and query string, with each drawn value as its placeholder. */
  readonly target: string;
  readonly headers: readonly SentHeader[];
  /** The body sent, and the payload it is when it is one. */
  readonly body?: BodyView & { readonly payload?: string };
  /** The statuses the answer may have, `4XX` for one the framework declares, or null for any. */
  readonly status: string | null;
  /** Which of the framework's declared statuses `4XX` is. */
  readonly declared?: string;
  readonly checks: readonly CheckedHeader[];
  /** The payload the answer's body has to equal, and how the two are compared. */
  readonly expect?: BodyView & { readonly payload: string; readonly compared: string; readonly note?: string };
  /** What is checked of the body when it is not a payload. Prose, with literals in backticks. */
  readonly bodyRule?: string;
}

/** A call made inside `once`, before the measured one, and what the test reads from its answer. */
export interface PrimeView {
  readonly method: string;
  readonly target: string;
  readonly reads: readonly string[];
}

/** Every published payload, by its value, which is how a request body is traced to its payload. */
const PAYLOADS = new Map<unknown, Payload>();
const walk = (v: unknown): void => {
  if (v === null || typeof v !== "object") return;
  if (isPayload(v)) PAYLOADS.set(v.value, v);
  else for (const x of Object.values(v)) walk(x);
};
walk(published);

/** The client-exception field each refusal's status is read from. */
const DECLARED: Readonly<Partial<Record<Assert["kind"], string>>> = {
  notFound: "notFound",
  wrongMethod: "wrongMethod",
  rejected: "rejected",
  unparseable: "malformed",
};

function cut(text: string): BodyView {
  const bytes = Buffer.byteLength(text);
  return text.length > BODY_LIMIT ? { text: text.slice(0, BODY_LIMIT), bytes, truncated: true } : { text, bytes, truncated: false };
}

/** A payload as the answer carries it: JSON as JSON.stringify writes it, lines and events framed, text as it is. */
function wireText(p: Payload, echo: readonly (keyof RunValues)[]): string {
  if (p.format === "lines") return (p.value as Json[]).map((row) => `${JSON.stringify(row)}\n`).join("");
  if (p.format === "events") return (p.value as Json[]).map((row) => `data: ${JSON.stringify(row)}\n\n`).join("");
  if (p.format !== "json") return String(p.value);
  const text = JSON.stringify(p.value);
  if (echo.length === 0) return text;
  const { client } = recorder();
  const values = placeholders(JSON.stringify(Object.fromEntries(echo.map((k) => [k, client.run[k]]))));
  return `${text.slice(0, -1)}${text === "{}" ? "" : ","}"echo":${values}}`;
}

function sentHeaders(call: RecordedCall, recording: Recording): SentHeader[] {
  const out = call.headers.map(([name, value]): SentHeader => {
    if (value === ETAG) return { name, value, note: "the etag the priming request answered with" };
    const choice = recording.choices.find((values) => String(values[0]) === value);
    if (choice !== undefined) return { name, value: list(choice.map(String), "or"), note: "picked per request" };
    return { name, value: placeholders(value) };
  });
  // The clients add the content type a body goes out with, as the wire shows it.
  const hasBody = call.body !== undefined || call.raw !== undefined;
  if (hasBody && !call.headers.some(([name]) => name.toLowerCase() === "content-type")) {
    out.push({ name: "content-type", value: call.rawType ?? "application/json" });
  }
  return out;
}

function sentBody(call: RecordedCall): CallView["body"] {
  if (call.body !== undefined) {
    const p = PAYLOADS.get(call.body);
    return { ...cut(JSON.stringify(call.body)), ...(p === undefined ? {} : { payload: p.name }) };
  }
  return call.raw === undefined ? undefined : cut(placeholders(call.raw));
}

function statusOf(asserts: readonly Assert[]): Pick<CallView, "status" | "declared"> {
  for (const a of asserts) {
    if (a.kind === "status") return { status: list(a.codes.map(String), "or") };
    if (a.kind === "ok") return { status: "200" };
    if (a.kind === "notModified") return { status: "304" };
    const declared = DECLARED[a.kind];
    if (declared !== undefined) return { status: "4XX", declared };
  }
  return { status: null };
}

function checkedHeaders(asserts: readonly Assert[]): CheckedHeader[] {
  const out: CheckedHeader[] = [];
  for (const a of asserts) {
    if (a.kind === "hasHeader") out.push({ name: a.name.toLowerCase(), rule: describeMatch(a.match) });
    else if (a.kind === "noHeader") out.push({ name: a.name.toLowerCase(), rule: "is absent" });
    else if (a.kind === "fresh") out.push({ name: "x-rb-serial", rule: "advances, so the handler ran" });
    else if (a.kind === "replayed") out.push({ name: "x-rb-serial", rule: "repeats, so a stored answer was replayed" });
    else if (a.kind === "bodyIs" && a.options.compressed === true) out.push({ name: "content-encoding", rule: `is ${code("gzip")}` });
    else if (a.kind === "bodyIs" && a.options.compressed === false) {
      out.push({ name: "content-encoding", rule: `is absent or ${code("identity")}` });
    }
  }
  return out;
}

function expected(asserts: readonly Assert[], declared: string | undefined): Pick<CallView, "expect" | "bodyRule"> {
  for (const a of asserts) {
    if (a.kind === "bodyIs") {
      const drawn = sentinelsIn(a.payload.name).map(([placeholder, value]) => `${value} for ${placeholder}`);
      return {
        expect: {
          ...cut(wireText(a.payload, a.options.echo ?? [])),
          payload: placeholders(a.payload.name),
          compared: COMPARED[a.payload.format],
          ...(drawn.length === 0 ? {} : { note: `Shown with ${list(drawn, "and")}.` }),
        },
      };
    }
    if (a.kind === "emptyBody") return { bodyRule: "No body." };
    if (a.kind === "sameBodyAs") return { bodyRule: "The same body as an earlier answer." };
    if (a.kind === "rejected") {
      const fields = list(a.fields.map(code), "and");
      const first = a.fields.length === 1 ? "" : ", or exactly one of them where the framework declares that it reports only the first error";
      return { bodyRule: `The framework's own error body, read through its client-exception. It has to name ${fields}${first}.` };
    }
  }
  return { bodyRule: declared === undefined ? "The body is not checked." : "The framework's own error body, which is not checked." };
}

export function callView(call: RecordedCall, recording: Recording): CallView {
  const body = sentBody(call);
  const status = statusOf(call.asserts);
  return {
    method: call.method,
    target: templateOf(call),
    headers: sentHeaders(call, recording),
    ...(body === undefined ? {} : { body }),
    ...status,
    checks: checkedHeaders(call.asserts),
    ...expected(call.asserts, status.declared),
  };
}

const READS: Readonly<Record<string, string>> = {
  etag: "its etag",
  json: "its body as JSON",
  text: "its body",
  recorded: "the whole answer",
};

export function primeView(call: RecordedCall): PrimeView {
  return {
    method: call.method,
    target: templateOf(call),
    reads: call.read.map((r) => (r.startsWith("header:") ? `its ${r.slice("header:".length)} header` : (READS[r] ?? r))),
  };
}
