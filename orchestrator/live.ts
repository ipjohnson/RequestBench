// The validating client's Transport over HTTP/1.1, to a framework that is actually running.
//
// It hands the validator what arrived and nothing more: the status, the headers with lower-case
// names, and the body's bytes with any content coding left on, because undoing gzip is the
// validator's job and a check that the body was compressed needs to see it compressed.
//
// Every exchange is also reported to `onExchange` as it went over the wire, which is what an
// exemplar is written from.
import http from "node:http";

import type { Request, Response, Transport } from "./validate.ts";

export interface Exchange {
  readonly request: Request;
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
  /** Closes every connection, so a stopped server is not left holding one open. */
  close(): void;
}

/** How long one answer may take before the call counts as failed. The gate runs under no load. */
const ANSWER_MS = 10_000;

export function http1(address: { host: string; port: number }, onExchange?: (e: Exchange) => void): Live {
  const agent = new http.Agent({ keepAlive: true, maxSockets: 8 });

  const transport: Transport = (req) =>
    new Promise<Response>((resolve, reject) => {
      const headers: Record<string, string> = { ...req.headers };
      const body = req.body === undefined ? undefined : Buffer.from(req.body);
      if (body !== undefined) headers["content-length"] = String(body.length);
      const outgoing = http.request(
        { host: address.host, port: address.port, method: req.method, path: req.target, headers, agent },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("error", reject);
          res.on("end", () => {
            const bytes = Buffer.concat(chunks);
            const joined: Record<string, string> = {};
            for (const [name, value] of Object.entries(res.headers)) {
              if (value !== undefined) joined[name] = Array.isArray(value) ? value.join(", ") : value;
            }
            const rawHeaders: [string, string][] = [];
            for (let i = 0; i + 1 < res.rawHeaders.length; i += 2) rawHeaders.push([res.rawHeaders[i]!, res.rawHeaders[i + 1]!]);
            onExchange?.({
              request: req,
              response: {
                status: res.statusCode ?? 0,
                statusMessage: res.statusMessage ?? "",
                httpVersion: res.httpVersion,
                rawHeaders,
                body: bytes,
              },
            });
            resolve({ status: res.statusCode ?? 0, headers: joined, body: bytes });
          });
        },
      );
      outgoing.on("error", reject);
      outgoing.setTimeout(ANSWER_MS, () => outgoing.destroy(new Error(`${req.method} ${req.target}: no answer within ${ANSWER_MS / 1000} s`)));
      outgoing.end(body);
    });

  return { transport, close: () => agent.destroy() };
}
