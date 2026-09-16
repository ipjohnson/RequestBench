// The transport. One connection, kept alive, requests issued in order.
//
// Ported from harness/conform.py. Two encodings: plain HTTP, and the Lambda one, where a
// RIE container serves only the invocations endpoint so plain HTTP reaches nothing.
import http from "node:http";
import type { Header, Encoding } from "./checks.js";

export const LAMBDA_INVOKE = "/2015-03-31/functions/function/invocations";

export type Reply = {
  readonly status: number;
  readonly headers: readonly Header[];
  readonly body: Buffer;
  readonly contentType: string | undefined;
};

/** An API Gateway v2 event, shaped the same way gen/serial.mjs shapes it. */
export function asEvent(
  method: string, path: string, body: string | undefined, headers: Readonly<Record<string, string>>,
): string {
  const qi = path.indexOf("?");
  const rawPath = qi === -1 ? path : path.slice(0, qi);
  const qs = qi === -1 ? "" : path.slice(qi + 1);
  const params: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(qs)) params[k] = v;
  return JSON.stringify({
    version: "2.0", rawPath, rawQueryString: qs,
    queryStringParameters: params,
    headers: { ...headers, "content-type": "application/json", host: "rb.invalid" },
    requestContext: { http: { method, path: rawPath } },
    body: body ?? null, isBase64Encoded: false,
  });
}

/**
 * Turn the Lambda result envelope back into a reply, so the comparison and the header
 * contract run on the same ground as any other host. A response that differs across hosts
 * is a bug, not a host characteristic.
 */
export function unwrap(raw: Buffer): Reply {
  const env = JSON.parse(raw.toString("utf8")) as {
    statusCode: number; headers?: Record<string, unknown>; body?: string; isBase64Encoded?: boolean;
  };
  // The envelope is JSON, so an adapter can give a header value as a number where HTTP
  // would always have given a string. Normalise here, once, rather than in every reader.
  const headers: Header[] = Object.entries(env.headers ?? {})
    .map(([k, v]) => [k, typeof v === "string" ? v : String(v)] as const);
  const text = env.body ?? "";
  const body = env.isBase64Encoded ? Buffer.from(text, "base64") : Buffer.from(text, "utf8");
  const ctype = headers.find(([k]) => k.toLowerCase() === "content-type")?.[1];
  return { status: env.statusCode, headers, body, contentType: ctype };
}

export class Transport {
  readonly #agent: http.Agent;
  readonly #host: string;
  readonly #port: number;
  readonly #encoding: Encoding;

  constructor(hostport: string, encoding: Encoding = "http", private readonly timeoutMs = 15_000) {
    const [host = "", port = ""] = hostport.split(":");
    this.#host = host;
    this.#port = Number(port || 80);
    this.#encoding = encoding;
    this.#agent = new http.Agent({ keepAlive: true, maxSockets: 1 });
  }

  /** Drop the pooled socket, the way the Python reconnects after a transport error. */
  reset(): void {
    this.#agent.destroy();
  }

  close(): void {
    this.#agent.destroy();
  }

  async send(
    method: string, path: string, body: string | undefined, headers: Readonly<Record<string, string>>,
  ): Promise<Reply> {
    if (this.#encoding === "lambda") {
      const event = asEvent(method, path, body, headers);
      const r = await this.#raw("POST", LAMBDA_INVOKE, event, { "content-type": "application/json" });
      if (r.status !== 200) throw new Error(`RIE returned ${r.status}`);
      return unwrap(r.body);
    }
    return this.#raw(method, path, body, headers);
  }

  #raw(
    method: string, path: string, body: string | undefined, headers: Readonly<Record<string, string>>,
  ): Promise<Reply> {
    return new Promise<Reply>((resolve, reject) => {
      const req = http.request(
        { host: this.#host, port: this.#port, method, path, headers, agent: this.#agent },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c: Buffer) => chunks.push(c));
          res.on("error", reject);
          res.on("end", () => {
            // rawHeaders keeps duplicates and original case, which is what the Python's
            // list(r.headers.items()) gives and what header_bytes counts.
            const pairs: Header[] = [];
            for (let i = 0; i + 1 < res.rawHeaders.length; i += 2) {
              pairs.push([res.rawHeaders[i] as string, res.rawHeaders[i + 1] as string]);
            }
            const ctype = pairs.find(([k]) => k.toLowerCase() === "content-type")?.[1];
            resolve({ status: res.statusCode ?? 0, headers: pairs, body: Buffer.concat(chunks), contentType: ctype });
          });
        },
      );
      req.setTimeout(this.timeoutMs, () => req.destroy(new Error("ETIMEDOUT")));
      req.on("error", reject);
      if (body !== undefined) req.write(body);
      req.end();
    });
  }
}
