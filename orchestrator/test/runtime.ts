// A Lambda runtime client in the test's own process, so the reference can stand in for a function.
// It asks the Runtime API for each event, hands the API Gateway payload format 2.0 request to a
// Transport, and posts the answer back as a proxy response, as a framework's adapter would.
import http from "node:http";

import type { Request, Transport } from "../validate.ts";

const API = "/2018-06-01/runtime";

interface Event {
  readonly rawPath: string;
  readonly rawQueryString: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly cookies?: readonly string[];
  readonly body?: string;
  readonly isBase64Encoded: boolean;
  readonly requestContext: { readonly http: { readonly method: string } };
}

export interface Runtime {
  alive(): boolean;
  stop(): void;
}

function call(agent: http.Agent, port: number, method: string, path: string, body?: string): Promise<{ headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const headers = body === undefined ? {} : { "content-type": "application/json", "content-length": Buffer.byteLength(body) };
    const req = http.request({ host: "127.0.0.1", port, method, path, agent, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve({ headers: res.headers, body: Buffer.concat(chunks) }));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.end(body);
  });
}

function requestOf(event: Event): Request {
  const headers: Record<string, string> = { ...event.headers };
  if (event.cookies !== undefined) headers["cookie"] = event.cookies.join("; ");
  const body = event.body === undefined ? undefined : event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  return {
    method: event.requestContext.http.method as Request["method"],
    target: event.rawQueryString === "" ? event.rawPath : `${event.rawPath}?${event.rawQueryString}`,
    headers,
    body,
  };
}

/** A runtime asking the Runtime API on `port` for events until it is stopped or the API goes. */
export function runtime(port: number, transport: Transport): Runtime {
  const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });
  let running = true;
  const stop = () => {
    running = false;
    agent.destroy();
  };
  void (async () => {
    try {
      while (running) {
        const next = await call(agent, port, "GET", `${API}/invocation/next`);
        const id = String(next.headers["lambda-runtime-aws-request-id"]);
        let answered: string;
        let outcome = "response";
        try {
          const answer = await transport(requestOf(JSON.parse(next.body.toString("utf8")) as Event));
          const { "set-cookie": cookie, ...headers } = answer.headers;
          answered = JSON.stringify({
            statusCode: answer.status,
            headers,
            ...(cookie === undefined ? {} : { cookies: [cookie] }),
            body: Buffer.from(answer.body).toString("base64"),
            isBase64Encoded: true,
          });
        } catch (error) {
          outcome = "error";
          answered = JSON.stringify({ errorMessage: String(error), errorType: "Error" });
        }
        await call(agent, port, "POST", `${API}/invocation/${id}/${outcome}`, answered);
      }
    } catch {
      // The Runtime API went away, which is how a run ends a function.
    } finally {
      stop();
    }
  })();
  return { alive: () => running, stop };
}
