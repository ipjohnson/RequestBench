// The measured client: what a test is handed while it is timed.
//
// It sends what the test builds and compares the status, and ignores every other assertion.
// Comparing a body per request would add work to the loop whose timing is the product, so the
// payloads are the validating client's to compare. A client is made per instance, and what its
// calls notice is left on it for the runner to read when the closure settles.
import http from "node:http";
import type { Assertion, Call, Client, Draw, Json, Method, Recorded, RunValues } from "@rb/tests/kit";

/** The statuses a framework declares in its client-exception package. */
export interface Statuses {
  readonly rejected: number;
  readonly malformed: number;
  readonly notFound: number;
  readonly wrongMethod: number;
}

/** What every instance in one thread shares. */
export interface Shared {
  readonly host: string;
  readonly port: number;
  readonly agent: http.Agent;
  readonly statuses: Statuses;
  readonly run: RunValues;
  readonly draw: Draw;
  readonly once: Once;
}

export const NOTHING_SENT =
  "the test sent nothing: a call goes on the wire when it is awaited or returned from the test";

/** Where `once` is refused, so the caller can say which test reached it. */
export class OnceRefused extends Error {}

/**
 * The values `once` hands out, keyed across the whole corpus. Priming runs every test before
 * anything is timed, and that is where they are made. A key the load reaches that priming did
 * not is made where it is reached, and every instance that waits on it goes unrecorded,
 * because nothing inside `once` is timed.
 */
export class Once {
  readonly #made = new Map<string, Promise<unknown>>();
  readonly #pending = new Set<string>();
  readonly #miss: "make" | "refuse";

  constructor(values: Iterable<readonly [string, unknown]>, miss: "make" | "refuse") {
    for (const [key, value] of values) this.#made.set(key, Promise.resolve(value));
    this.#miss = miss;
  }

  get<T>(key: string, make: () => T | Promise<T>, client: MeasuredClient): Promise<T> {
    const known = this.#made.get(key);
    if (known !== undefined) {
      if (this.#pending.has(key)) client.untimed = true;
      return known as Promise<T>;
    }
    if (this.#miss === "refuse") return Promise.reject(new OnceRefused(`once(${JSON.stringify(key)})`));
    client.untimed = true;
    const made = new Promise<T>((resolve) => resolve(make()));
    this.#made.set(key, made);
    this.#pending.add(key);
    const settled = () => this.#pending.delete(key);
    made.then(settled, settled);
    return made;
  }

  /** Every value made so far, to hand to the threads that time the load. */
  values(): Promise<[string, unknown][]> {
    return Promise.all([...this.#made].map(async ([key, made]): Promise<[string, unknown]> => [key, await made]));
  }
}

export class MeasuredClient implements Client {
  readonly #shared: Shared;
  /** Requests this instance put on the wire. */
  sent = 0;
  /** The first answer whose status was not the one declared, as the report prints it. */
  mismatch: string | undefined;
  /** This instance waited on a `once` value being made, so its time holds work that is not timed. */
  untimed = false;
  /** The status of the last answer. */
  status = 0;

  constructor(shared: Shared) {
    this.#shared = shared;
  }

  get run(): RunValues {
    return this.#shared.run;
  }

  get draw(): Draw {
    return this.#shared.draw;
  }

  get(path: string): Call {
    return new MeasuredCall(this.#shared, this, "GET", path);
  }

  head(path: string): Call {
    return new MeasuredCall(this.#shared, this, "HEAD", path);
  }

  post(path: string, body?: Json): Call {
    return new MeasuredCall(this.#shared, this, "POST", path, body);
  }

  put(path: string, body?: Json): Call {
    return new MeasuredCall(this.#shared, this, "PUT", path, body);
  }

  patch(path: string, body?: Json): Call {
    return new MeasuredCall(this.#shared, this, "PATCH", path, body);
  }

  delete(path: string): Call {
    return new MeasuredCall(this.#shared, this, "DELETE", path);
  }

  options(path: string): Call {
    return new MeasuredCall(this.#shared, this, "OPTIONS", path);
  }

  once<T>(key: string, make: () => T | Promise<T>): Promise<T> {
    return this.#shared.once.get(key, make, this);
  }

  expect<T>(): Assertion<T> {
    return { is() {}, isNot() {}, satisfies() {} };
  }
}

interface Reply {
  readonly status: number;
  readonly headers: http.IncomingHttpHeaders;
  /** Kept only when a reader asked for it before the answer arrived. */
  readonly body: Buffer | undefined;
}

/**
 * One request. Awaiting it answers nothing, because the measured client parses no body. A
 * reader is the way to a value. A reader of the body has to be called before the answer
 * arrives, because a body nothing asked for is thrown away as it is read.
 */
class MeasuredCall<T = void> implements Call<T> {
  readonly #shared: Shared;
  readonly #client: MeasuredClient;
  readonly #method: Method;
  readonly #path: string;
  #query = "";
  readonly #headers: Record<string, string> = {};
  #body: Buffer | undefined;
  /** The statuses the test declared, any one of which is right. Empty until one is declared. */
  #expected: readonly number[] = [];
  #answered = 0;
  #keep = false;
  #reply: Promise<Reply> | undefined;

  constructor(shared: Shared, client: MeasuredClient, method: Method, path: string, body?: Json) {
    this.#shared = shared;
    this.#client = client;
    this.#method = method;
    this.#path = path;
    if (body !== undefined) this.#body = encoded(body);
  }

  header(name: string, value: string): Call<T> {
    this.#headers[name] = value;
    return this;
  }

  query(name: string, value: string): Call<T> {
    // encodeURIComponent writes a space as %20 and never +, which is how RFC 3986 reads it.
    this.#query += `${this.#query === "" ? "" : "&"}${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
    return this;
  }

  body(value: Json): Call<T> {
    this.#body = encoded(value);
    return this;
  }

  raw(text: string, contentType?: string): Call<T> {
    this.#body = encodedText(text);
    if (contentType !== undefined) this.#headers["content-type"] = contentType;
    return this;
  }

  status(code: number, ...or: number[]): Call<T> {
    return this.#expect(code, ...or);
  }

  ok(): Call<T> {
    return this.#expect(200);
  }

  okWith(): Call<T> {
    return this.#expect(200);
  }

  bodyIs(): Call<T> {
    return this;
  }

  notModified(): Call<T> {
    return this.#expect(304);
  }

  notFound(): Call<T> {
    return this.#expect(this.#shared.statuses.notFound);
  }

  wrongMethod(): Call<T> {
    return this.#expect(this.#shared.statuses.wrongMethod);
  }

  rejected(): Call<T> {
    return this.#expect(this.#shared.statuses.rejected);
  }

  unparseable(): Call<T> {
    return this.#expect(this.#shared.statuses.malformed);
  }

  hasHeader(): Call<T> {
    return this;
  }

  noHeader(): Call<T> {
    return this;
  }

  emptyBody(): Call<T> {
    return this;
  }

  sameBodyAs(): Call<T> {
    return this;
  }

  fresh(): Call<T> {
    return this;
  }

  replayed(): Call<T> {
    return this;
  }

  etag(): Promise<string> {
    return this.#send().then((reply) => {
      const tag = reply.headers.etag;
      if (tag === undefined) throw new Error(`${this.#describe()} answered ${reply.status} with no etag`);
      return tag;
    });
  }

  headerValue(name: string): Promise<string | undefined> {
    return this.#send().then((reply) => joined(reply.headers[name.toLowerCase()]));
  }

  json<U = Json>(): Promise<U> {
    return this.#read().then(([, body]) => JSON.parse(body.toString("utf8")) as U);
  }

  text(): Promise<string> {
    return this.#read().then(([, body]) => body.toString("utf8"));
  }

  recorded(): Promise<Recorded> {
    return this.#read().then(([reply, body]) => ({
      status: reply.status,
      headers: Object.fromEntries(Object.entries(reply.headers).map(([name, value]) => [name, joined(value) ?? ""])),
      bytes: body.length,
      text: body.toString("utf8"),
    }));
  }

  then<A = T, B = never>(
    onfulfilled?: ((value: T) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): Promise<A | B> {
    return this.#send()
      .then(() => undefined as T)
      .then(onfulfilled, onrejected);
  }

  #expect(...codes: number[]): this {
    const before = this.#expected;
    if (before.length > 0 && (before.length !== codes.length || before.some((code, i) => code !== codes[i]))) {
      throw new Error(`${this.#describe()} declares status ${before.join(" or ")} and then ${codes.join(" or ")}`);
    }
    this.#expected = codes;
    if (this.#answered !== 0) this.#compare();
    return this;
  }

  #compare(): void {
    if (this.#expected.length > 0 && !this.#expected.includes(this.#answered)) {
      this.#client.mismatch ??= `${this.#describe()} answered ${this.#answered}, expected ${this.#expected.join(" or ")}`;
    }
  }

  #target(): string {
    if (this.#query === "") return this.#path;
    return `${this.#path}${this.#path.includes("?") ? "&" : "?"}${this.#query}`;
  }

  #describe(): string {
    return `${this.#method} ${this.#target()}`;
  }

  #read(): Promise<readonly [Reply, Buffer]> {
    this.#keep = true;
    return this.#send().then((reply) => {
      if (reply.body === undefined) {
        throw new Error(`${this.#describe()}: the body was thrown away before a reader asked for it`);
      }
      return [reply, reply.body] as const;
    });
  }

  #send(): Promise<Reply> {
    return (this.#reply ??= this.#go());
  }

  #go(): Promise<Reply> {
    const { host, port, agent } = this.#shared;
    const client = this.#client;
    const headers = this.#headers;
    const body = this.#body;
    if (body !== undefined) {
      // A raw body with no content type of its own goes out as JSON too. It is there to reach the
      // parser, and a content type the framework does not parse would be refused before the parser ran.
      if (!Object.keys(headers).some((name) => name.toLowerCase() === "content-type")) {
        headers["content-type"] = "application/json";
      }
      headers["content-length"] = String(body.length);
    }
    client.sent++;

    return new Promise<Reply>((resolve, reject) => {
      const req = http.request({ host, port, agent, method: this.#method, path: this.#target(), headers }, (res) => {
        const status = res.statusCode ?? 0;
        this.#answered = status;
        client.status = status;
        this.#compare();

        const chunks: Buffer[] | undefined = this.#keep ? [] : undefined;
        if (chunks === undefined) res.resume();
        else res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => resolve({ status, headers: res.headers, body: chunks && Buffer.concat(chunks) }));
        res.on("error", reject);
        res.on("close", () => {
          if (!res.complete) reject(new Error(`${this.#describe()}: the connection closed before the answer ended`));
        });
      });
      req.on("error", reject);
      req.end(body);
    });
  }
}

/**
 * A body as the bytes it goes out as. A test hands over the same payload value on every
 * instance, so each is serialised once rather than inside every instance's timed window.
 */
const serialised = new WeakMap<object, Buffer>();

function encoded(value: Json): Buffer {
  if (typeof value !== "object" || value === null) return Buffer.from(JSON.stringify(value));
  let bytes = serialised.get(value);
  if (bytes === undefined) serialised.set(value, (bytes = Buffer.from(JSON.stringify(value))));
  return bytes;
}

/**
 * A raw body as bytes, by its text, for the same reason. A raw body is the same text on every
 * instance of a run, so this holds a few entries. The bound is for a test that ever draws one.
 */
const texts = new Map<string, Buffer>();

function encodedText(text: string): Buffer {
  let bytes = texts.get(text);
  if (bytes === undefined) {
    if (texts.size >= 64) texts.clear();
    texts.set(text, (bytes = Buffer.from(text)));
  }
  return bytes;
}

const joined = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value.join(", ") : value;

/** xorshift32, so each thread walks the tests and the fixture its own way, and every run the same way. */
export function xorshift(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/** An error as one line, for a report that keeps the first of each test's. */
export function describe(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const code = (error as NodeJS.ErrnoException).code;
  return code !== undefined && !error.message.includes(code) ? `${code} ${error.message}` : error.message;
}
