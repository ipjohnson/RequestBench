import type { BodyOptions, Payload } from "./payload.ts";

export type Json =
  | null
  | boolean
  | number
  | string
  | readonly Json[]
  | { readonly [key: string]: Json };

export type Method = "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS";

/**
 * The Standard Schema surface, restated here rather than imported so the kit
 * depends on no validation library. zod, valibot and arktype all satisfy it.
 */
export interface Schema<Input = unknown, Output = Input> {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (value: unknown) => SchemaResult<Output> | Promise<SchemaResult<Output>>;
    readonly types?: { readonly input: Input; readonly output: Output } | undefined;
  };
}

export type SchemaResult<Output> =
  | { readonly value: Output; readonly issues?: undefined }
  | { readonly issues: readonly SchemaIssue[] };

export interface SchemaIssue {
  readonly message: string;
  readonly path?: readonly (PropertyKey | { readonly key: PropertyKey })[] | undefined;
}

/**
 * A request under construction. Awaiting it sends it; every method returns the
 * call so a test reads as one sentence. Sending is memoised, so a chain that is
 * both awaited and read from still goes on the wire once.
 */
export interface Call<T = void> extends PromiseLike<T> {
  header(name: string, value: string): Call<T>;
  query(name: string, value: string): Call<T>;
  body(value: Json): Call<T>;

  /**
   * A body that is not JSON: a form, or bytes that are not JSON at all for the row
   * that measures the parser failing. Without a content type it goes out as JSON,
   * because it is there to reach the JSON parser.
   */
  raw(text: string, contentType?: string): Call<T>;

  /** One of these statuses. More than one where frameworks split on a status the standard leaves open. */
  status(code: number, ...or: number[]): Call<T>;
  ok(): Call<T>;
  /** 200, and exactly this body. */
  okWith(payload: Payload, options?: BodyOptions): Call<T>;
  /**
   * The body, without saying anything about the status. `okWith` is this and
   * `ok`; a 201 needs the two apart.
   */
  bodyIs(payload: Payload, options?: BodyOptions): Call<T>;
  notModified(): Call<T>;
  notFound(): Call<T>;

  /**
   * A method the route does not answer. Frameworks split between 405 and 404, so
   * the status is read from the framework's own declaration.
   */
  wrongMethod(): Call<T>;

  /**
   * Refused, with these fields named. The status and the field paths are read
   * through the framework's own exceptions declaration, so a test never sees
   * the shape of an error body.
   */
  rejected(...fields: string[]): Call<T>;

  /**
   * Refused before the body was ever bound. A parser failure names no field and
   * is not always the status a field rejection carries, so the framework
   * declares it separately.
   */
  unparseable(): Call<T>;

  hasHeader(name: string, match?: string | RegExp): Call<T>;
  noHeader(name: string): Call<T>;
  emptyBody(): Call<T>;
  sameBodyAs(other: Recorded): Call<T>;

  /**
   * The handler ran for this request, read off `x-rb-serial`. A response served
   * from a store anywhere in the framework's own path, or precomputed at boot,
   * repeats a counter it did not increment. Identical bytes are the whole point
   * of the comparison, so nothing else can tell the two apart.
   */
  fresh(): Call<T>;

  /**
   * This answer came out of a store rather than out of the handler. The same
   * counter read the other way: a serial that moved between two requests for one
   * cache key means nothing was replayed.
   */
  replayed(): Call<T>;

  /** Readers. These resolve to a value, so they are the only way out of the assertion surface. */
  etag(): Promise<string>;
  headerValue(name: string): Promise<string | undefined>;
  json<U = Json>(): Promise<U>;
  text(): Promise<string>;
  recorded(): Promise<Recorded>;
}

/** An answer kept for a later comparison. */
export interface Recorded {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly bytes: number;
  readonly text: string;
}

/**
 * Values drawn once per run, after the decision to run, and never given to a
 * framework. A handler binds one and writes it back, so the echo is checked
 * against what was sent and a framework answering from a table would have had to
 * know them in advance. The names are the ones that go on the wire, because that
 * comparison is field by field.
 */
export interface RunValues {
  readonly one: number;
  readonly two: number;
  readonly tenant: string;
  readonly requestId: string;
  readonly account: number;
  readonly page: number;
  readonly size: number;
  readonly status: string;
  readonly category: string;
  readonly sort: string;
  readonly q: string;
  readonly minPrice: number;
  readonly maxPrice: number;
}

/** A value picked per instance, rather than drawn once per run. */
export interface Draw {
  /**
   * One of these, per instance. The vary rows send a combination per instance so
   * the store has to hold a key for each; sending one would make them a cache hit
   * measured twice.
   */
  choice<T>(values: readonly T[]): T;

  /**
   * The id of a row of the large item payload, per instance, so each instance
   * reads a different row rather than the one the first instance read.
   */
  item(): number;
}

export interface Client {
  readonly run: RunValues;
  readonly draw: Draw;

  get(path: string): Call;
  head(path: string): Call;
  post(path: string, body?: Json): Call;
  put(path: string, body?: Json): Call;
  patch(path: string, body?: Json): Call;
  delete(path: string): Call;
  options(path: string): Call;

  /**
   * Run this the first time it is reached for a framework and reuse the answer
   * after that, keyed across the whole corpus. Nothing inside it is timed.
   * Seeded state does not belong here; that is what a resource is for. This is
   * for a value only the framework can produce, like a validator to send back.
   */
  once<T>(key: string, make: () => T | Promise<T>): Promise<T>;

  /**
   * For a test that reads a value and compares it itself. A failure reported
   * through this is a named assertion the runner can print; a thrown Error is
   * a stack trace.
   */
  expect<T>(actual: T, what?: string): Assertion<T>;
}

export interface Assertion<T> {
  is(expected: T): void;
  isNot(expected: T): void;
  satisfies(predicate: (value: T) => boolean, why: string): void;
}

/** The body of a test. Everything it does outside `once` is inside the measured window. */
export type Body = (c: Client) => unknown;

/**
 * Generated from discovery once the orchestrator exists, the same way
 * FrameworkId is. Until then a wrong family name is caught at load, by the
 * directory the file is in, rather than by the compiler.
 */
export type FamilyName = string;

export interface TestId {
  readonly family: FamilyName;
  readonly name: string;
}

/** The key in the plan, the snapshot and every result row. */
export function idOf(id: TestId): string {
  return `${id.family}.${id.name}`;
}

export interface Family {
  readonly name: FamilyName;
  readonly about: string;
  readonly comparable: string;
  /**
   * Its tests, keyed by `id.name`. Holding them here is what lets the factory
   * check that every test in a family declares that family, from the one file
   * that has both facts.
   */
  readonly tests: Readonly<Record<string, Test>>;
}

/**
 * Every family, and every test in them. The one thing a run, a recording and the
 * site all start from.
 */
export interface Suite {
  readonly families: Readonly<Record<FamilyName, Family>>;
  /** Keyed by `family.name`, which is the key in every result row. */
  readonly tests: Readonly<Record<string, Test>>;
}

export interface Framework {
  readonly language: string;
  readonly name: string;
  readonly framework: string;
  readonly hosts: Readonly<Record<string, unknown>>;
  readonly mechanisms: Readonly<Record<string, { readonly kind: string; readonly dependency?: string }>>;
}

export interface PerformanceTest {
  readonly kind: "performance";
  readonly id: TestId;
  /** The endpoint this row measures. Declared rather than buried in the closure, because the site and the handler marks both need it. */
  readonly path: string;
  readonly about: string;
  readonly request: Body;
}

export interface ValidationTest {
  readonly kind: "validation";
  readonly id: TestId;
  readonly path?: string;
  readonly about: string;
  readonly request: Body;
  readonly scope?: (f: Framework) => boolean;
  readonly leaves?: string;
}

export type Test = PerformanceTest | ValidationTest;
