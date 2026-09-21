// The validating client: it sends every request a test makes and runs every
// assertion the test declares against the answer.
//
// This is the conformance pass. It runs under no load, so it can afford what the
// measured client never does: compare every body with the payload it should carry,
// and read every error envelope through the framework's own declaration.
import { gunzipSync } from "node:zlib";

import { EnvelopeMismatch } from "@rb/tests/kit";
import type {
  Assertion,
  BodyOptions,
  Call,
  Client,
  Draw,
  Exceptions,
  Json,
  Method,
  Payload,
  Recorded,
  RunValues,
} from "@rb/tests/kit";

export interface Request {
  readonly method: Method;
  /** The path with its query string, percent-encoded. */
  readonly target: string;
  /** Lower-case names. */
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string | undefined;
}

export interface Response {
  readonly status: number;
  /** Lower-case names. */
  readonly headers: Readonly<Record<string, string>>;
  /** The bytes as they arrived, before any content coding is undone. */
  readonly body: Uint8Array;
}

/** How a request reaches a framework: over the network in a run, from a reference in a unit test. */
export type Transport = (request: Request) => Promise<Response>;

/** One assertion that did not hold, named by the method that declared it. */
export interface Failure {
  readonly kind: string;
  readonly message: string;
}

export interface Session {
  readonly client: Client;
  /** Everything that failed since the session began, in order. */
  readonly failures: Failure[];
  /** Calls built and never sent. A test cannot mean to build one, so it is a bug in the test. */
  unsent(): number;
}

/** An answer with its content coding undone, which is what every assertion reads. */
interface Answer {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly text: string;
  readonly bytes: number;
  /** The path and every header sent, which is what a response cache would have to be keyed on. */
  readonly cacheKey: string;
}

const enc = (s: string) => encodeURIComponent(s);

/**
 * gzip output differs between zlib, Java's Deflater and Go's compress/flate at the
 * same level, and the decompressed bytes must not, so the comparison is taken over
 * those. A body that claims gzip and is not is left as it came.
 */
function decode(r: Response, cacheKey: string): Answer {
  let bytes = r.body;
  if ((r.headers["content-encoding"] ?? "").includes("gzip") && bytes.length > 0) {
    try {
      bytes = gunzipSync(bytes);
    } catch {
      // a claimed coding that does not decode is the header's problem, and a check of it will say so
    }
  }
  return { status: r.status, headers: r.headers, text: new TextDecoder().decode(bytes), bytes: bytes.length, cacheKey };
}

function parse(text: string): { ok: true; value: unknown } | { ok: false; why: string } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, why: `the body is not JSON (${(e as Error).message})` };
  }
}

/** A value short enough to sit in a failure line. */
function show(v: unknown): string {
  const text = v === undefined ? "nothing" : JSON.stringify(v);
  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
}

const at = (path: string, key: string | number) => (path === "" ? String(key) : `${path}.${key}`);

/**
 * The first place `actual` departs from `expected`, as a dotted path and both
 * values, or null when they are the same value. Object keys may come in any order.
 */
function difference(actual: unknown, expected: unknown, path = ""): string | null {
  const here = path === "" ? "the body" : path;
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return `${here} is ${show(actual)}, expected a list`;
    for (let i = 0; i < Math.min(actual.length, expected.length); i++) {
      const d = difference(actual[i], expected[i], at(path, i));
      if (d !== null) return d;
    }
    return actual.length === expected.length ? null : `${here} has ${actual.length} entries, expected ${expected.length}`;
  }
  if (expected !== null && typeof expected === "object") {
    if (actual === null || typeof actual !== "object" || Array.isArray(actual)) return `${here} is ${show(actual)}, expected an object`;
    const a = actual as Record<string, unknown>;
    for (const [key, value] of Object.entries(expected)) {
      if (!Object.hasOwn(a, key)) return `${at(path, key)} is missing`;
      const d = difference(a[key], value, at(path, key));
      if (d !== null) return d;
    }
    const extra = Object.keys(a).find((key) => !Object.hasOwn(expected, key));
    return extra === undefined ? null : `${at(path, extra)} is ${show(a[extra])}, which is not expected`;
  }
  return actual === expected ? null : `${here} is ${show(actual)}, expected ${show(expected)}`;
}

/**
 * Python's `\s` on bytes is ASCII-only and JavaScript's is not, so this is spelled
 * out to leave a non-breaking space inside content alone, as upstream did.
 */
const ASCII_WS = /[ \t\n\r\f\v]+/g;

/** Whitespace at an element boundary goes, and a run inside text becomes one space. */
const page = (html: string) => html.replace(ASCII_WS, " ").replace(/>[ ]+/g, ">").replace(/[ ]+</g, "<").trim();

/** Where two texts first part, with a little of each from there. */
function parting(actual: string, expected: string): string {
  let i = 0;
  while (i < actual.length && i < expected.length && actual[i] === expected[i]) i++;
  return `at character ${i}: ${show(actual.slice(i, i + 40))}, expected ${show(expected.slice(i, i + 40))}`;
}

function coding(a: Answer, compressed: boolean | undefined): string | null {
  const encoding = a.headers["content-encoding"];
  const gzip = (encoding ?? "").includes("gzip");
  if (compressed === true && !gzip) return `the body arrived ${encoding === undefined ? "with no content coding" : `as ${encoding}`}, expected gzip`;
  if (compressed === false && encoding !== undefined && encoding !== "identity") return `the body arrived as ${encoding}, expected no content coding`;
  return null;
}

/** The whole answer against a payload, read the way the payload's format says. */
function mismatch(a: Answer, payload: Payload, options: BodyOptions, run: RunValues): string | null {
  const coded = coding(a, options.compressed);
  if (coded !== null) return coded;
  const not = `the body is not ${payload.name}:`;

  switch (payload.format) {
    case "json": {
      const p = parse(a.text);
      if (!p.ok) return p.why;
      const echo = options.echo ?? [];
      const expected =
        echo.length === 0
          ? payload.value
          : { ...(payload.value as Record<string, unknown>), echo: Object.fromEntries(echo.map((k) => [k, run[k]])) };
      const d = difference(p.value, expected);
      return d === null ? null : `${not} ${d}`;
    }
    case "lines": {
      const rows = payload.value as readonly unknown[];
      const text = a.text.endsWith("\n") ? a.text.slice(0, -1) : a.text;
      const got = text === "" ? [] : text.split("\n");
      for (let i = 0; i < Math.min(got.length, rows.length); i++) {
        const p = parse(got[i]!);
        if (!p.ok) return `line ${i + 1}: ${p.why}`;
        const d = difference(p.value, rows[i]);
        if (d !== null) return `${not} line ${i + 1}, ${d}`;
      }
      return got.length === rows.length ? null : `${not} ${got.length} lines, expected ${rows.length}`;
    }
    case "text": {
      const expected = payload.value as string;
      return a.text === expected ? null : `${not} ${a.bytes} bytes, expected ${new TextEncoder().encode(expected).length}, ${parting(a.text, expected)}`;
    }
    case "html": {
      const got = page(a.text);
      const expected = page(payload.value as string);
      return got === expected ? null : `${not} ${parting(got, expected)}`;
    }
  }
}

function serial(a: Answer): number | string {
  const v = a.headers["x-rb-serial"];
  if (v === undefined) return "no x-rb-serial";
  if (!/^\d+$/.test(v)) return `x-rb-serial ${JSON.stringify(v)} is not a number`;
  return Number(v);
}

export function validator(d: {
  transport: Transport;
  exceptions: Exceptions;
  run: RunValues;
  draw: Draw;
}): Session {
  const failures: Failure[] = [];
  const primed = new Map<string, Promise<unknown>>();
  /** The last serial a handler wrote on a route that must run it every time. */
  let lastFresh: number | null = null;
  /** The serial each cache key answered with the first time it was asked. */
  const firstStored = new Map<string, number>();
  let built = 0;
  let sent = 0;

  function open(method: Method, path: string, initial?: Json): Call {
    built++;
    const query: [string, string][] = [];
    const headers: [string, string][] = [];
    let json: Json | undefined = initial;
    let raw: string | undefined;
    let rawType: string | undefined;
    const pending: (() => void)[] = [];
    let answer: Answer | undefined;
    let sending: Promise<Answer> | undefined;

    const send = () =>
      (sending ??= (async () => {
        sent++;
        const target = query.length === 0 ? path : `${path}?${query.map(([k, v]) => `${enc(k)}=${enc(v)}`).join("&")}`;
        const h: Record<string, string> = {};
        for (const [k, v] of headers) h[k.toLowerCase()] = v;
        const body = raw ?? (json === undefined ? undefined : JSON.stringify(json));
        if (body !== undefined && h["content-type"] === undefined) h["content-type"] = rawType ?? "application/json";
        const cacheKey = [target, ...Object.entries(h).map(([k, v]) => `${k}=${v}`).sort()].join("|");
        answer = decode(await d.transport({ method, target, headers: h, body }), cacheKey);
        for (const run of pending.splice(0)) run();
        return answer;
      })());

    const check = (kind: string, why: (a: Answer) => string | null) => {
      const run = () => {
        const message = why(answer!);
        if (message !== null) failures.push({ kind, message: `${method} ${path}: ${message}` });
      };
      if (answer) run();
      else pending.push(run);
      return call;
    };

    const status = (kind: string, ...expected: number[]) =>
      check(kind, (a) => (expected.includes(a.status) ? null : `answered ${a.status}, expected ${expected.join(" or ")}`));

    const read = async <T>(value: (a: Answer) => T): Promise<T> => value(await send());

    const call = {
      header: (name: string, value: string) => (headers.push([name, value]), call),
      query: (name: string, value: string) => (query.push([name, value]), call),
      body: (value: Json) => ((json = value), call),
      raw: (text: string, contentType?: string) => ((raw = text), (rawType = contentType), call),

      status: (code: number, ...or: number[]) => status("status", code, ...or),
      ok: () => status("ok", 200),
      okWith: (payload: Payload, options: BodyOptions = {}) => (status("ok", 200), call.bodyIs(payload, options)),
      bodyIs: (payload: Payload, options: BodyOptions = {}) => check("bodyIs", (a) => mismatch(a, payload, options, d.run)),
      notModified: () => status("notModified", 304),
      notFound: () => status("notFound", d.exceptions.notFound),
      wrongMethod: () => status("wrongMethod", d.exceptions.wrongMethod),
      unparseable: () => status("unparseable", d.exceptions.malformed),

      rejected: (...fields: string[]) =>
        check("rejected", (a) => {
          if (a.status !== d.exceptions.rejected) return `answered ${a.status}, expected ${d.exceptions.rejected}`;
          const p = parse(a.text);
          if (!p.ok) return p.why;
          let named: readonly string[];
          try {
            named = d.exceptions.read(p.value).fields;
          } catch (e) {
            if (e instanceof EnvelopeMismatch) return e.message;
            throw e;
          }
          if (d.exceptions.reports === "first") {
            return named.length === 1 && fields.includes(named[0]!)
              ? null
              : `named ${JSON.stringify(named)}, expected exactly one of ${JSON.stringify(fields)}`;
          }
          const got = [...named].sort();
          const want = [...fields].sort();
          return JSON.stringify(got) === JSON.stringify(want) ? null : `named ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`;
        }),

      hasHeader: (name: string, match?: string | RegExp) =>
        check("hasHeader", (a) => {
          const v = a.headers[name.toLowerCase()];
          if (v === undefined) return `no ${name} header`;
          if (match === undefined) return null;
          const hit = typeof match === "string" ? v === match : match.test(v);
          return hit ? null : `${name} is ${JSON.stringify(v)}, which does not match ${String(match)}`;
        }),
      noHeader: (name: string) =>
        check("noHeader", (a) => {
          const v = a.headers[name.toLowerCase()];
          return v === undefined ? null : `unexpected ${name}: ${JSON.stringify(v)}`;
        }),
      emptyBody: () => check("emptyBody", (a) => (a.bytes === 0 ? null : `the body is ${a.bytes} bytes, expected none`)),
      sameBodyAs: (other: Recorded) => check("sameBodyAs", (a) => (a.text === other.text ? null : "the body differs")),

      fresh: () =>
        check("fresh", (a) => {
          const s = serial(a);
          if (typeof s === "string") return `${s} (the response must prove the handler ran)`;
          const before = lastFresh;
          lastFresh = s;
          return before !== null && s <= before ? `x-rb-serial did not advance (${s} after ${before})` : null;
        }),
      replayed: () =>
        check("replayed", (a) => {
          const s = serial(a);
          if (typeof s === "string") return `${s} (the response must say which run of the handler produced it)`;
          const first = firstStored.get(a.cacheKey);
          if (first === undefined) {
            firstStored.set(a.cacheKey, s);
            return null;
          }
          return s === first ? null : `x-rb-serial ${s} where the stored response carries ${first}, so nothing was replayed`;
        }),

      etag: () =>
        read((a) => {
          const v = a.headers["etag"];
          if (v === undefined) failures.push({ kind: "etag", message: `${method} ${path}: no etag header to read` });
          return v ?? "";
        }),
      headerValue: (name: string) => read((a) => a.headers[name.toLowerCase()]),
      json: () =>
        read((a) => {
          const p = parse(a.text);
          if (!p.ok) failures.push({ kind: "json", message: `${method} ${path}: ${p.why}` });
          return p.ok ? p.value : null;
        }),
      text: () => read((a) => a.text),
      recorded: () =>
        read((a): Recorded => ({ status: a.status, headers: a.headers, bytes: a.bytes, text: a.text })),

      then: <R1, R2>(
        onfulfilled?: ((value: unknown) => R1 | PromiseLike<R1>) | null,
        onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
      ) =>
        send()
          .then((a) => {
            const p = parse(a.text);
            return p.ok ? p.value : undefined;
          })
          .then(onfulfilled, onrejected),
    };

    return call as unknown as Call;
  }

  const client: Client = {
    run: d.run,
    draw: d.draw,

    get: (path) => open("GET", path),
    head: (path) => open("HEAD", path),
    post: (path, body) => open("POST", path, body),
    put: (path, body) => open("PUT", path, body),
    patch: (path, body) => open("PATCH", path, body),
    delete: (path) => open("DELETE", path),
    options: (path) => open("OPTIONS", path),

    once: <T>(key: string, make: () => T | Promise<T>) => {
      let p = primed.get(key);
      if (p === undefined) {
        p = Promise.resolve(make());
        primed.set(key, p);
      }
      return p as Promise<T>;
    },

    expect: <T>(actual: T, what?: string): Assertion<T> => {
      const fail = (message: string) => failures.push({ kind: "expect", message: `${what ?? "value"}: ${message}` });
      return {
        is: (expected) => void (Object.is(actual, expected) || fail(`${JSON.stringify(actual)} is not ${JSON.stringify(expected)}`)),
        isNot: (expected) => void (Object.is(actual, expected) && fail(`${JSON.stringify(actual)} should not be it`)),
        satisfies: (predicate, why) => void (predicate(actual) || fail(why)),
      };
    },
  };

  return { client, failures, unsent: () => built - sent };
}
