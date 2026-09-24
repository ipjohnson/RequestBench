// The corpus compiled into the requests the load sends.
//
// A test declares its request as a closure. Running one allocates and costs a few microseconds,
// and both land inside the time the load records, so the load never runs one. This runs each
// closure once per instance against the framework about to be measured, before anything is timed,
// and keeps what went out and what came back: the request, the statuses the test declared, and the
// length of a 2xx body, which the load then compares against every answer. The request names no
// protocol. It goes out through the Rust program, which writes it as the host speaks, so priming
// reads each answer the way the load will.
//
// How many instances a test has follows from what its closure draws: every combination of the
// values a `choice` picks from, and rows of the large payload spread across the count, up to the
// load's `instances`. A test that draws nothing has one.
import type {
  Assertion,
  BodyOptions,
  Call,
  Client,
  Draw,
  Json,
  Method,
  Payload,
  PerformanceTest,
  Recorded,
  RunValues,
} from "@rb/tests/kit";
import { idOf } from "@rb/tests/kit";
import { LARGE } from "@rb/tests/models/payload";
import type { Exchanged, Pipe, WireRequest } from "./pipe.ts";

/** The statuses a framework declares in its client-exception package. */
export interface Statuses {
  readonly rejected: number;
  readonly malformed: number;
  readonly notFound: number;
  readonly wrongMethod: number;
}

export interface Prepared {
  readonly request: WireRequest;
  /** The method and target, as a mismatch line names them. */
  readonly target: string;
  /** The statuses the test declared, any one of which is right. */
  readonly accepted: readonly number[];
  /**
   * What this request's 2xx body measured at priming, which every answer to it has to measure
   * again. An answer that is not 2xx carries the framework's own error body, which may hold a
   * time or a trace id, so nothing is compared but its status.
   */
  readonly bodyBytes: number | undefined;
}

/** One test's requests, in the order the report lists the tests. */
export interface Compiled {
  readonly id: string;
  readonly instances: readonly Prepared[];
}

export interface PrepareOptions {
  /** The Rust program, already reaching the framework. */
  readonly pipe: Pipe;
  readonly tests: readonly PerformanceTest[];
  readonly statuses: Statuses;
  readonly run: RunValues;
  /** The most requests to compile per test. */
  readonly instances: number;
  /** Told about an answer that is not the status its test declared, which is the framework's answer and not a test that cannot be sent. */
  readonly log: (line: string) => void;
}

/** A test that cannot be sent at all, which ends the load before a phase is spent finding out. */
export class PrepareError extends Error {}

const NOTHING_SENT = "the test sent nothing: a call goes on the wire when it is awaited or returned from the test";
const TWICE = "a performance test sends one request outside once, so that the load can send it as bytes";

export async function prepare(o: PrepareOptions): Promise<Compiled[]> {
  const once = new Once();
  const out: Compiled[] = [];
  for (const test of o.tests) {
    const id = idOf(test.id);
    // The first instance takes the first of every value and says what the closure draws.
    const first = await run(test, sweep(0, 1, undefined));
    const sizes = first.sizes;
    const count = Math.min(o.instances, sizes.reduce((n, size) => n * size, 1));
    const instances = [first.prepared];
    for (let i = 1; i < count; i++) instances.push((await run(test, sweep(i, count, sizes))).prepared);
    // A wrong status is the framework's answer, not a test that cannot be sent, so the load
    // goes on and counts it in every instance.
    const wrong = instances.find((instance) => !instance.accepted.includes(instance.status));
    if (wrong !== undefined) {
      o.log(`  ${id}: ${wrong.target} answered ${wrong.status}, expected ${wrong.accepted.join(" or ")}`);
    }
    out.push({ id, instances });
  }
  return out;

  async function run(test: PerformanceTest, drawn: { draw: Draw; sizes: number[] }) {
    const client = new PreparingClient(o.pipe, o.statuses, o.run, drawn.draw, once);
    const id = idOf(test.id);
    try {
      await test.request(client);
    } catch (error) {
      throw new PrepareError(`priming ${id}: ${(error as Error).message}`);
    }
    const subject = client.subject;
    if (subject === undefined) throw new PrepareError(`priming ${id}: ${NOTHING_SENT}`);
    if (client.outside > 1) throw new PrepareError(`priming ${id}: ${TWICE}`);
    return { prepared: subject, sizes: drawn.sizes };
  }
}

/** What a prepared request answered, kept so priming can report a wrong status. */
interface Subject extends Prepared {
  readonly status: number;
}

/**
 * The draw for one instance. The first pass records what the closure asks for; the passes after
 * it walk those. Where every combination fits in the count, each instance is a different one;
 * where it does not, as with the 1,425 rows of the large payload, each draw is spread evenly
 * across the count.
 */
function sweep(index: number, count: number, sizes: readonly number[] | undefined): { draw: Draw; sizes: number[] } {
  const seen: number[] = [];
  const pick = (size: number): number => {
    const at = seen.length;
    seen.push(size);
    if (sizes === undefined || at >= sizes.length) return 0;
    const product = sizes.reduce((n, s) => n * s, 1);
    if (product <= count) {
      let stride = 1;
      for (let i = 0; i < at; i++) stride *= sizes[i]!;
      return Math.floor(index / stride) % size;
    }
    return Math.floor((index * size) / count) % size;
  };
  return {
    draw: {
      item: () => 1 + pick(LARGE),
      choice: <T>(values: readonly T[]): T => values[pick(values.length)] as T,
    },
    sizes: seen,
  };
}

/**
 * The values `once` hands out, keyed across the whole corpus. Nothing here is timed, and the
 * calls a `make` sends are a means rather than the row's subject, so they are not compiled.
 */
class Once {
  readonly #made = new Map<string, unknown>();

  async get<T>(key: string, make: () => T | Promise<T>, client: PreparingClient): Promise<T> {
    if (this.#made.has(key)) return this.#made.get(key) as T;
    client.priming = true;
    try {
      const value = await make();
      this.#made.set(key, value);
      return value;
    } finally {
      client.priming = false;
    }
  }
}

class PreparingClient implements Client {
  readonly pipe: Pipe;
  readonly statuses: Statuses;
  readonly run: RunValues;
  readonly draw: Draw;
  readonly #once: Once;
  /** Set while a `once` value is being made, so the calls it sends are not the row's subject. */
  priming = false;
  /** Calls sent outside `once`. A test that sends two cannot be compiled. */
  outside = 0;
  subject: Subject | undefined;

  constructor(pipe: Pipe, statuses: Statuses, run: RunValues, draw: Draw, once: Once) {
    this.pipe = pipe;
    this.statuses = statuses;
    this.run = run;
    this.draw = draw;
    this.#once = once;
  }

  get(path: string): Call {
    return new PreparingCall(this, "GET", path);
  }

  head(path: string): Call {
    return new PreparingCall(this, "HEAD", path);
  }

  post(path: string, body?: Json): Call {
    return new PreparingCall(this, "POST", path, body);
  }

  put(path: string, body?: Json): Call {
    return new PreparingCall(this, "PUT", path, body);
  }

  patch(path: string, body?: Json): Call {
    return new PreparingCall(this, "PATCH", path, body);
  }

  delete(path: string): Call {
    return new PreparingCall(this, "DELETE", path);
  }

  options(path: string): Call {
    return new PreparingCall(this, "OPTIONS", path);
  }

  once<T>(key: string, make: () => T | Promise<T>): Promise<T> {
    return this.#once.get(key, make, this);
  }

  expect<T>(): Assertion<T> {
    return { is() {}, isNot() {}, satisfies() {} };
  }

  /** The row's subject, which is the last call it sent outside `once`. */
  sent(call: Subject, priming: boolean): void {
    if (priming) return;
    this.outside++;
    this.subject = call;
  }
}

/** An answer as priming reads it: header names in lower case, a repeated one joined with commas. */
interface Answer {
  readonly status: number;
  readonly bodyBytes: number;
  readonly headers: ReadonlyMap<string, string>;
  readonly body: Buffer;
}

function answerOf(a: Exchanged): Answer {
  const headers = new Map<string, string>();
  for (const [raw, value] of a.headers) {
    const name = raw.toLowerCase();
    headers.set(name, headers.has(name) ? `${headers.get(name)}, ${value}` : value);
  }
  return { status: a.status, bodyBytes: a.bodyBytes, headers, body: a.body };
}

class PreparingCall<T = void> implements Call<T> {
  readonly #client: PreparingClient;
  readonly #method: Method;
  readonly #path: string;
  readonly #priming: boolean;
  #query = "";
  readonly #headers: [string, string][] = [];
  #body: Buffer | undefined;
  #expected: readonly number[] = [];
  #answer: Promise<Answer> | undefined;

  constructor(client: PreparingClient, method: Method, path: string, body?: Json) {
    this.#client = client;
    this.#method = method;
    this.#path = path;
    this.#priming = client.priming;
    if (body !== undefined) this.#body = Buffer.from(JSON.stringify(body));
  }

  header(name: string, value: string): Call<T> {
    this.#headers.push([name, value]);
    return this;
  }

  query(name: string, value: string): Call<T> {
    // encodeURIComponent writes a space as %20 and never +, which is how RFC 3986 reads it.
    this.#query += `${this.#query === "" ? "" : "&"}${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
    return this;
  }

  body(value: Json): Call<T> {
    this.#body = Buffer.from(JSON.stringify(value));
    return this;
  }

  raw(text: string, contentType?: string): Call<T> {
    this.#body = Buffer.from(text);
    if (contentType !== undefined) this.#headers.push(["content-type", contentType]);
    return this;
  }

  status(code: number, ...or: number[]): Call<T> {
    return this.#expect(code, ...or);
  }

  ok(): Call<T> {
    return this.#expect(200);
  }

  okWith(_payload: Payload, _options?: BodyOptions): Call<T> {
    return this.#expect(200);
  }

  bodyIs(): Call<T> {
    return this;
  }

  notModified(): Call<T> {
    return this.#expect(304);
  }

  notFound(): Call<T> {
    return this.#expect(this.#client.statuses.notFound);
  }

  wrongMethod(): Call<T> {
    return this.#expect(this.#client.statuses.wrongMethod);
  }

  rejected(): Call<T> {
    return this.#expect(this.#client.statuses.rejected);
  }

  unparseable(): Call<T> {
    return this.#expect(this.#client.statuses.malformed);
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
    return this.#send().then((answer) => {
      const tag = answer.headers.get("etag");
      if (tag === undefined) throw new Error(`${this.#describe()} answered ${answer.status} with no etag`);
      return tag;
    });
  }

  headerValue(name: string): Promise<string | undefined> {
    return this.#send().then((answer) => answer.headers.get(name.toLowerCase()));
  }

  json<U = Json>(): Promise<U> {
    return this.#send().then((answer) => JSON.parse(answer.body.toString("utf8")) as U);
  }

  text(): Promise<string> {
    return this.#send().then((answer) => answer.body.toString("utf8"));
  }

  recorded(): Promise<Recorded> {
    return this.#send().then((answer) => ({
      status: answer.status,
      headers: Object.fromEntries(answer.headers),
      bytes: answer.bodyBytes,
      text: answer.body.toString("utf8"),
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
    return this;
  }

  #target(): string {
    if (this.#query === "") return this.#path;
    return `${this.#path}${this.#path.includes("?") ? "&" : "?"}${this.#query}`;
  }

  #describe(): string {
    return `${this.#method} ${this.#target()}`;
  }

  /** The request as it goes out. Sent once, however many times the call is awaited or read. */
  #send(): Promise<Answer> {
    if (this.#answer !== undefined) return this.#answer;
    const target = this.#target();
    const headers = [...this.#headers];
    // A raw body with no content type of its own goes out as JSON too. It is there to reach the
    // parser, and a type the framework does not parse would be refused before it ran. The length
    // is the protocol's to write.
    if (this.#body !== undefined && !headers.some(([name]) => name.toLowerCase() === "content-type")) {
      headers.push(["content-type", "application/json"]);
    }
    const request: WireRequest = {
      method: this.#method,
      target,
      headers,
      ...(this.#body === undefined ? {} : { body: this.#body.toString("base64") }),
    };
    this.#answer = this.#client.pipe.exchange(request).then((exchanged) => {
      const answer = answerOf(exchanged);
      this.#client.sent(
        {
          request,
          target: `${this.#method} ${target}`,
          accepted: this.#expected,
          bodyBytes: answer.status >= 200 && answer.status < 300 ? answer.bodyBytes : undefined,
          status: answer.status,
        },
        this.#priming,
      );
      return answer;
    });
    return this.#answer;
  }
}
