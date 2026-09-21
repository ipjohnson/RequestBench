// The recording client: it sends nothing, hands back stubs, and keeps what a test
// asked for.
//
// A test declares its request as a closure, so the only way to read that request
// is to run it. Nothing here touches the wire, so what comes back is the whole of
// what a test says about one endpoint, which is what the endpoint page and the
// OpenAPI document are built from.
import type { Assertion, BodyOptions, Call, Client, Draw, Json, Method, Payload, Recorded, RunValues } from "@rb/tests/kit";

export type Assert =
  | { readonly kind: "status"; readonly codes: readonly number[] }
  | { readonly kind: "ok" }
  | { readonly kind: "bodyIs"; readonly payload: Payload; readonly options: BodyOptions }
  | { readonly kind: "notModified" }
  | { readonly kind: "notFound" }
  | { readonly kind: "wrongMethod" }
  | { readonly kind: "rejected"; readonly fields: readonly string[] }
  | { readonly kind: "unparseable" }
  | { readonly kind: "hasHeader"; readonly name: string; readonly match: string | RegExp | undefined }
  | { readonly kind: "noHeader"; readonly name: string }
  | { readonly kind: "emptyBody" }
  | { readonly kind: "sameBodyAs" }
  | { readonly kind: "fresh" }
  | { readonly kind: "replayed" };

export interface RecordedCall {
  readonly method: Method;
  readonly path: string;
  readonly query: [string, string][];
  readonly headers: [string, string][];
  body: Json | undefined;
  raw: string | undefined;
  /** The content type a raw body declared, or undefined for one that goes out as JSON. */
  rawType: string | undefined;
  readonly asserts: Assert[];
  /** Made inside `once`, so it is a priming request and not the row's subject. */
  readonly priming: boolean;
  readonly read: string[];
}

export interface Recording {
  readonly calls: RecordedCall[];
  /** Which run values and draws the closure reached for, in order. */
  readonly uses: string[];
  /** The values each `draw.choice` picked from, in order. The stub always picks the first. */
  readonly choices: (readonly unknown[])[];
  readonly expectations: string[];
}

/**
 * What the stubs answer with, and the placeholder each one stands for.
 *
 * A value is a sentinel rather than something realistic so a recorded path can be
 * turned back into the template it came from. `/parameters/900001/segment/literal`
 * rewrites to `/parameters/{run.one}/segment/literal` mechanically, which is what makes
 * the declared `path` checkable against what the closure actually sent instead of merely
 * similar to it.
 */
const SENTINEL = new Map<string | number, string>();

function sentinel<T extends string | number>(value: T, placeholder: string): T {
  SENTINEL.set(value, placeholder);
  return value;
}

const RUN: RunValues = {
  one: sentinel(900001, "{run.one}"),
  two: sentinel(900002, "{run.two}"),
  tenant: sentinel("__rb_tenant__", "{run.tenant}"),
  requestId: sentinel("__rb_request_id__", "{run.requestId}"),
  account: sentinel(900003, "{run.account}"),
  page: sentinel(900004, "{run.page}"),
  size: sentinel(900005, "{run.size}"),
  status: sentinel("__rb_run_status__", "{run.status}"),
  category: sentinel("__rb_category__", "{run.category}"),
  sort: sentinel("__rb_sort__", "{run.sort}"),
  q: sentinel("__rb_q__", "{run.q}"),
  minPrice: sentinel(900006, "{run.minPrice}"),
  maxPrice: sentinel(900007, "{run.maxPrice}"),
};

/** A real row, because a test builds the row it expects from the id, but one no literal in a path spells. */
const ITEM = sentinel(1417, "{draw.item}");

/** What `etag()` reads back, standing for the validator the framework answered with. */
export const ETAG = '"{etag}"';

/** `text` with every sentinel in it put back as the placeholder it stands for. */
export function placeholders(text: string): string {
  let out = text;
  for (const [value, placeholder] of SENTINEL) out = out.split(String(value)).join(placeholder);
  return out;
}

/**
 * The route and query a call actually sent, with every sentinel put back as the
 * placeholder it stands for. This is what a declared `path` is compared against.
 */
export function templateOf(call: RecordedCall): string {
  const route = placeholders(call.path);
  if (call.query.length === 0) return route;
  return `${route}?${call.query.map(([k, v]) => `${k}=${placeholders(v)}`).join("&")}`;
}

export function recorder(): { client: Client; recording: Recording } {
  const recording: Recording = { calls: [], uses: [], choices: [], expectations: [] };
  let priming = false;

  function open(method: Method, path: string, body?: Json): Call {
    const rec: RecordedCall = {
      method,
      path,
      query: [],
      headers: [],
      body,
      raw: undefined,
      rawType: undefined,
      asserts: [],
      priming,
      read: [],
    };
    recording.calls.push(rec);

    const put = (a: Assert) => {
      rec.asserts.push(a);
      return call;
    };
    const readBack = <T>(what: string, value: T): Promise<T> => {
      rec.read.push(what);
      return Promise.resolve(value);
    };

    // One object stands in for every Call<T>, so the casts here are the price of a
    // stub that satisfies a generic interface. Nothing outside this file sees them.
    const call = {
      header: (name: string, value: string) => (rec.headers.push([name, value]), call),
      query: (name: string, value: string) => (rec.query.push([name, value]), call),
      body: (value: Json) => ((rec.body = value), call),
      raw: (text: string, contentType?: string) => ((rec.raw = text), (rec.rawType = contentType), call),

      status: (code: number, ...or: number[]) => put({ kind: "status", codes: [code, ...or] }),
      ok: () => put({ kind: "ok" }),
      okWith: (payload: Payload, options: BodyOptions = {}) => (put({ kind: "ok" }), put({ kind: "bodyIs", payload, options })),
      bodyIs: (payload: Payload, options: BodyOptions = {}) => put({ kind: "bodyIs", payload, options }),
      notModified: () => put({ kind: "notModified" }),
      notFound: () => put({ kind: "notFound" }),
      wrongMethod: () => put({ kind: "wrongMethod" }),
      rejected: (...fields: string[]) => put({ kind: "rejected", fields }),
      unparseable: () => put({ kind: "unparseable" }),

      hasHeader: (name: string, match?: string | RegExp) => put({ kind: "hasHeader", name, match }),
      noHeader: (name: string) => put({ kind: "noHeader", name }),
      emptyBody: () => put({ kind: "emptyBody" }),
      sameBodyAs: (_other: Recorded) => put({ kind: "sameBodyAs" }),
      fresh: () => put({ kind: "fresh" }),
      replayed: () => put({ kind: "replayed" }),

      etag: () => readBack("etag", ETAG),
      headerValue: (name: string) => readBack(`header:${name}`, `{${name}}`),
      json: () => readBack("json", null),
      text: () => readBack("text", ""),
      recorded: () => readBack("recorded", { status: 0, headers: {}, bytes: 0, text: "" }),

      then: (onfulfilled?: ((value: never) => unknown) | null) =>
        Promise.resolve(undefined as never).then(onfulfilled),
    } as unknown as Call;

    return call;
  }

  const run = {} as Record<string, unknown>;
  for (const key of Object.keys(RUN)) {
    Object.defineProperty(run, key, {
      enumerable: true,
      get: () => {
        recording.uses.push(`run.${key}`);
        return RUN[key as keyof RunValues];
      },
    });
  }

  const drew = <T>(name: string, value: T): T => {
    recording.uses.push(`draw.${name}`);
    return value;
  };

  const draw: Draw = {
    // A vary value is a real one, not a parameter: the store has to hold a key per
    // combination, so what matters is that the values differ rather than what they are.
    choice: <T>(values: readonly T[]) => (recording.choices.push(values), drew("choice", values[0] as T)),
    item: () => drew("item", ITEM),
  };

  const client: Client = {
    run: run as unknown as RunValues,
    draw,

    get: (path) => open("GET", path),
    head: (path) => open("HEAD", path),
    post: (path, body) => open("POST", path, body),
    put: (path, body) => open("PUT", path, body),
    patch: (path, body) => open("PATCH", path, body),
    delete: (path) => open("DELETE", path),
    options: (path) => open("OPTIONS", path),

    // Nothing is memoised across tests: a recording wants the priming request
    // written down every time, because that is a call the endpoint page has to show.
    once: async (_key, make) => {
      priming = true;
      try {
        return await make();
      } finally {
        priming = false;
      }
    },

    expect: <T>(_actual: T, what?: string) => {
      recording.expectations.push(what ?? "unnamed");
      const noop: Assertion<T> = { is: () => {}, isNot: () => {}, satisfies: () => {} };
      return noop;
    },
  };

  return { client, recording };
}
