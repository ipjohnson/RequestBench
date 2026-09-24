// The validating client's Transport, to a framework that is actually running, through the traffic
// generator's Rust program. The gate then sends exactly the bytes the load sends, and reads each
// answer with the parser the load reads it with.
//
// It hands the validator what arrived and nothing more: the status, the headers with lower-case
// names, and the body's bytes with any content coding left on, because undoing gzip is the
// validator's job and a check that the body was compressed needs to see it compressed.
//
// Every exchange is also reported to `onExchange` as it went over the wire, which is what an
// exemplar is written from.
import { Pipe } from "../traffic-generator/pipe.ts";
import type { Request, Response, Transport } from "./validate.ts";

export interface Exchange {
  readonly request: Request;
  /** The Host header the request carried, which names the address the request was sent to. */
  readonly hostHeader: string;
  readonly response: {
    readonly status: number;
    readonly statusMessage: string;
    readonly httpVersion: string;
    /** Names as the framework spelled them, in the order it wrote them. */
    readonly rawHeaders: readonly (readonly [string, string])[];
    readonly body: Buffer;
  };
}

export interface Live {
  readonly transport: Transport;
  /** Ends the program and every connection it holds, so a stopped server is not left holding one open. */
  close(): Promise<void>;
}

/** How long one answer may take before the call counts as failed. The gate runs under no load. */
const ANSWER_MS = 10_000;

/**
 * The headers node:http kept the first of when an answer repeated them. The validator read
 * node:http's view before it read the Rust program's, so a repeated header still reads the same.
 * Any other repeated header is joined with a comma.
 */
const FIRST_ONLY = new Set([
  "age",
  "authorization",
  "content-length",
  "content-type",
  "etag",
  "expires",
  "from",
  "host",
  "if-modified-since",
  "if-unmodified-since",
  "last-modified",
  "location",
  "max-forwards",
  "proxy-authorization",
  "referer",
  "retry-after",
  "server",
  "user-agent",
]);

export function http1(address: { host: string; port: number }, onExchange?: (e: Exchange) => void): Live {
  const pipe = Pipe.start(address);

  const transport: Transport = async (req) => {
    const body = req.body === undefined ? {} : { body: Buffer.from(req.body).toString("base64") };
    const answer = await pipe.exchange({ method: req.method, target: req.target, headers: Object.entries(req.headers), ...body }, ANSWER_MS);
    const joined: Record<string, string> = {};
    for (const [raw, value] of answer.headers) {
      const name = raw.toLowerCase();
      if (joined[name] === undefined) joined[name] = value;
      else if (!FIRST_ONLY.has(name)) joined[name] = `${joined[name]}, ${value}`;
    }
    onExchange?.({
      request: req,
      hostHeader: answer.host,
      response: {
        status: answer.status,
        statusMessage: answer.reason,
        httpVersion: answer.version,
        rawHeaders: answer.headers,
        body: answer.body,
      },
    });
    const response: Response = { status: answer.status, headers: joined, body: answer.body };
    return response;
  };

  return { transport, close: () => pipe.close() };
}
