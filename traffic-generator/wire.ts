// The wire: one HTTP/1.1 connection carrying one request at a time, and the pool a thread draws
// from.
//
// A request's bytes were built before anything was timed, so sending one is a write. Reading one
// is the smallest parser that can say where the answer ends: the status, the headers that frame
// the body, and then the body by its length, by its chunks, or by the close. Everything else a
// test asserts is the validating client's to compare, under no load.
//
// node:http did this until the load was measured against it. It costs 17 to 27 microseconds more
// per request on the rows that answer in a hundred, it charges for each chunk a framework writes,
// and it opens a new connection for every HEAD answer that carries no content-length, which
// RFC 9112 6.3 allows because such an answer ends at the blank line.
import net from "node:net";

/** A request as prepare.ts built it. */
export interface Request {
  /** The request line, the headers, the blank line, and the body. */
  readonly bytes: Buffer;
  /** An answer to HEAD ends with its headers, whatever they say about a body. */
  readonly head: boolean;
  /** Keep the answer's headers and body. Priming does; nothing in the load does. */
  readonly keep?: boolean;
}

export interface Answer {
  readonly status: number;
  /** The body with the chunk framing off and any content coding still on. */
  readonly bodyBytes: number;
  /** The chunks it arrived in, or 0 for a body whose length was declared. */
  readonly chunks: number;
  /** Lower-case names, kept only when the request asked for them. */
  readonly headers?: ReadonlyMap<string, string>;
  readonly body?: Buffer;
}

type Stage = "idle" | "head" | "fixed" | "size" | "chunk" | "trailer" | "eof";

const CLOSED = "the connection closed before the answer ended";

class Connection {
  readonly #socket: net.Socket;
  /** Settles when the connection is up, or fails when it cannot be made. */
  readonly ready: Promise<void>;
  #stage: Stage = "idle";
  /** A head that has not arrived whole yet. */
  #pending: Buffer | null = null;
  #status = 0;
  /** Bytes still to read of the body, or of the chunk being read. */
  #left = 0;
  /** A chunk size or trailer line split across two reads. */
  #line = "";
  #bytes = 0;
  #chunks = 0;
  #headRequest = false;
  #keep = false;
  #headers: Map<string, string> | null = null;
  #body: Buffer[] | null = null;
  /** The answer said this connection ends with it. */
  #ends = false;
  #done: ((answer: Answer) => void) | null = null;
  #failed: ((error: Error) => void) | null = null;

  constructor(host: string, port: number, closed: (connection: Connection) => void) {
    this.#socket = net.createConnection({ host, port, noDelay: true });
    this.ready = new Promise((resolve, reject) => {
      this.#socket.once("connect", resolve);
      this.#socket.once("error", reject);
    });
    this.#socket.on("data", (chunk: Buffer) => this.#read(chunk));
    this.#socket.on("error", (error: Error) => this.#fail(error));
    this.#socket.on("close", () => {
      // A body framed by the close ends here. Anything else was cut off.
      if (this.#stage === "eof") this.#finish();
      else if (this.#done !== null) this.#fail(new Error(CLOSED));
      closed(this);
    });
  }

  /** Whether this connection can carry another request. */
  get reusable(): boolean {
    return !this.#ends && !this.#socket.destroyed;
  }

  send(request: Request, done: (answer: Answer) => void, failed: (error: Error) => void): void {
    this.#done = done;
    this.#failed = failed;
    this.#stage = "head";
    this.#pending = null;
    this.#status = 0;
    this.#left = 0;
    this.#line = "";
    this.#bytes = 0;
    this.#chunks = 0;
    this.#ends = false;
    this.#headRequest = request.head;
    this.#keep = request.keep === true;
    this.#headers = this.#keep ? new Map() : null;
    this.#body = this.#keep ? [] : null;
    this.#socket.write(request.bytes);
  }

  destroy(): void {
    this.#done = null;
    this.#failed = null;
    this.#socket.destroy();
  }

  #read(chunk: Buffer): void {
    let buf = chunk;
    if (this.#pending !== null) {
      buf = Buffer.concat([this.#pending, chunk]);
      this.#pending = null;
    }
    let at = 0;
    if (this.#stage === "head") {
      const end = buf.indexOf("\r\n\r\n");
      if (end < 0) {
        this.#pending = buf;
        return;
      }
      at = end + 4;
      if (!this.#readHead(buf, end)) return;
    }
    while (at < buf.length && this.#stage !== "idle") {
      if (this.#stage === "fixed" || this.#stage === "chunk" || this.#stage === "eof") {
        const take = this.#stage === "eof" ? buf.length - at : Math.min(this.#left, buf.length - at);
        // A chunk's own trailing CRLF is in `left` and is not body.
        const body = this.#stage === "chunk" ? Math.max(0, Math.min(take, this.#left - 2)) : take;
        if (this.#body !== null && body > 0) this.#body.push(buf.subarray(at, at + body));
        this.#bytes += body;
        this.#left -= take;
        at += take;
        if (this.#stage === "eof") continue;
        if (this.#left === 0) {
          if (this.#stage === "fixed") return this.#finish();
          this.#stage = "size";
        }
      } else {
        const nl = buf.indexOf(10, at);
        const text = buf.toString("latin1", at, nl < 0 ? buf.length : nl + 1);
        at = nl < 0 ? buf.length : nl + 1;
        this.#line += text;
        if (nl < 0) continue;
        const line = this.#line;
        this.#line = "";
        if (this.#stage === "size") {
          const size = Number.parseInt(line, 16);
          if (Number.isNaN(size)) return this.#fail(new Error(`a chunk size the answer wrote as ${JSON.stringify(line.trim())}`));
          if (size === 0) this.#stage = "trailer";
          else {
            this.#chunks++;
            this.#left = size + 2;
            this.#stage = "chunk";
          }
        } else if (line === "\r\n" || line === "\n") return this.#finish();
      }
    }
    if (this.#stage === "trailer" && at === buf.length && this.#line === "") return;
  }

  /** The status and how the body is framed, or false when the answer cannot be read. */
  #readHead(buf: Buffer, end: number): boolean {
    const text = buf.toString("latin1", 0, end);
    const first = text.indexOf("\r\n");
    this.#status = Number.parseInt(text.slice(9, 12), 10);
    if (!text.startsWith("HTTP/1.") || Number.isNaN(this.#status)) {
      this.#fail(new Error(`an answer starting ${JSON.stringify(text.slice(0, 32))}`));
      return false;
    }
    let length: number | undefined;
    let chunked = false;
    for (const line of first < 0 ? [] : text.slice(first + 2).split("\r\n")) {
      const colon = line.indexOf(":");
      if (colon < 0) continue;
      const name = line.slice(0, colon).toLowerCase();
      const value = line.slice(colon + 1).trim();
      if (this.#headers !== null) this.#headers.set(name, this.#headers.has(name) ? `${this.#headers.get(name)}, ${value}` : value);
      if (name === "content-length") length = Number(value);
      else if (name === "transfer-encoding") chunked ||= value.toLowerCase().includes("chunked");
      else if (name === "connection") this.#ends ||= value.toLowerCase().includes("close");
    }
    // RFC 9112 6.3: an answer to HEAD, a 1xx, a 204 or a 304 ends at the blank line.
    if (this.#headRequest || this.#status === 204 || this.#status === 304 || this.#status < 200) {
      this.#finish();
      return false;
    }
    if (chunked) {
      this.#stage = "size";
    } else if (length !== undefined) {
      if (length === 0) {
        this.#finish();
        return false;
      }
      this.#left = length;
      this.#stage = "fixed";
    } else {
      // Nothing frames it, so it ends when the connection does.
      this.#ends = true;
      this.#stage = "eof";
    }
    return true;
  }

  #finish(): void {
    const done = this.#done;
    this.#done = null;
    this.#failed = null;
    this.#stage = "idle";
    if (done === null) return;
    const kept = this.#keep ? { headers: this.#headers!, body: Buffer.concat(this.#body!) } : {};
    done({ status: this.#status, bodyBytes: this.#bytes, chunks: this.#chunks, ...kept });
  }

  #fail(error: Error): void {
    const failed = this.#failed;
    this.#done = null;
    this.#failed = null;
    this.#stage = "idle";
    this.#socket.destroy();
    failed?.(error);
  }
}

/**
 * The connections one thread sends on, as many as the load declares for it. A connection carries
 * one request at a time, so the pool never hands out more at once than it holds, and the caller
 * never asks for more: an instance due while they are all busy is dropped rather than queued.
 *
 * They are handed out in turn rather than newest first, so every connection the load declares
 * carries traffic. A framework that serves each connection from a different process or thread
 * sees the whole population that way, instead of whichever few the last instances landed on.
 */
export class Pool {
  readonly #host: string;
  readonly #port: number;
  readonly #free: Connection[] = [];
  readonly #live = new Set<Connection>();
  /** How many the load declared for this thread. */
  #want = 0;
  #stopped = false;

  constructor(host: string, port: number) {
    this.#host = host;
    this.#port = port;
  }

  /**
   * Opens what the thread is short of and waits for it. Called before the first phase and again
   * before each one after it, so a phase begins with the connections the load declared and no
   * instance pays for a handshake. Between phases nothing is timed, so this costs nothing.
   */
  async open(count: number): Promise<void> {
    this.#want = count;
    const made = Array.from({ length: count - this.#live.size }, () => this.#make());
    await Promise.all(made.map((connection) => connection.ready));
    this.#free.push(...made);
  }

  send(request: Request, done: (answer: Answer) => void, failed: (error: Error) => void): void {
    // A connection an answer closed was replaced before that answer was counted, so this finds
    // one free unless the framework closed one without saying so.
    const connection = this.#free.shift() ?? this.#make();
    connection.send(
      request,
      (answer) => {
        if (connection.reusable) {
          this.#free.push(connection);
          return done(answer);
        }
        // The answer closed its connection. Its replacement is opened now and the answer is
        // counted once the replacement is up, so the handshake is charged to the test whose
        // answer cost it, and not to whichever instance next finds no connection free. A
        // replacement that cannot be made leaves the answer counted, and the next instance
        // that needs a connection opens one.
        connection.destroy();
        if (this.#stopped) return done(answer);
        const replacement = this.#make();
        replacement.ready.then(
          () => {
            this.#free.push(replacement);
            done(answer);
          },
          () => done(answer),
        );
      },
      (error) => {
        connection.destroy();
        failed(error);
      },
    );
  }

  /** The connections open and waiting for a request. */
  get idle(): number {
    return this.#free.length;
  }

  destroy(): void {
    this.#stopped = true;
    for (const connection of this.#live) connection.destroy();
    this.#live.clear();
    this.#free.length = 0;
  }

  #make(): Connection {
    const connection = new Connection(this.#host, this.#port, (dead) => this.#lost(dead));
    this.#live.add(connection);
    return connection;
  }

  /**
   * A framework closes a connection when it answers with `connection: close`, when it frames a
   * body by the close, when its keep-alive idles out, and when it has served as many requests on
   * one as it will. One an answer closed was replaced in `send`. Any other is forgotten here and
   * opened again at the next phase, or by the instance that needs it first. Opening one the moment
   * it goes would instead chase a framework whose keep-alive idles out, making a new connection
   * every time it closes one that the load is not using.
   */
  #lost(dead: Connection): void {
    if (!this.#live.delete(dead)) return;
    const at = this.#free.indexOf(dead);
    if (at >= 0) this.#free.splice(at, 1);
  }
}

/** An error as one line, for a report that keeps the first of each test's. */
export function describe(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const code = (error as NodeJS.ErrnoException).code;
  return code !== undefined && !error.message.includes(code) ? `${code} ${error.message}` : error.message;
}
