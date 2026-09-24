// A Transport served over a real socket, so the reference can stand in for a framework that is
// running: the live transport, the gate and the orchestrator all reach it the way they reach one.
// Over h2c it is served as HTTP/2 with prior knowledge, and the request's :authority reaches the
// transport as its Host, as a framework's server hands it on.
import http from "node:http";
import http2 from "node:http2";
import type { AddressInfo } from "node:net";

import type { Transport } from "../validate.ts";

export interface Served {
  readonly host: string;
  readonly port: number;
  close(): Promise<void>;
}

/** Headers HTTP/2 forbids, which node:http2 refuses to write. */
const CONNECTION_SPECIFIC = new Set(["connection", "keep-alive", "proxy-connection", "transfer-encoding", "upgrade"]);

type Req = http.IncomingMessage | http2.Http2ServerRequest;
/** What both servers' responses share. */
interface Res {
  writeHead(status: number, headers: Record<string, string>): unknown;
  end(body: Buffer): unknown;
}

export async function serve(transport: Transport, protocol: "http/1.1" | "h2c" = "http/1.1"): Promise<Served> {
  const h2 = protocol === "h2c";
  const handler = (req: Req, res: Res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const headers: Record<string, string> = {};
      for (const [name, value] of Object.entries(req.headers)) {
        if (value === undefined || name.startsWith(":")) continue;
        headers[name] = Array.isArray(value) ? value.join(", ") : value;
      }
      if (h2 && headers["host"] === undefined) headers["host"] = String(req.headers[":authority"] ?? "");
      transport({
        method: (req.method ?? "GET") as Parameters<Transport>[0]["method"],
        target: req.url ?? "/",
        headers,
        body: chunks.length === 0 ? undefined : Buffer.concat(chunks).toString("utf8"),
      }).then(
        (answer) => {
          const sent = h2 ? Object.fromEntries(Object.entries(answer.headers).filter(([name]) => !CONNECTION_SPECIFIC.has(name))) : answer.headers;
          res.writeHead(answer.status, sent);
          res.end(Buffer.from(answer.body));
        },
        (error: unknown) => {
          res.writeHead(500, { "content-type": "text/plain" });
          res.end(Buffer.from(String(error)));
        },
      );
    });
  };
  if (h2) {
    const server = http2.createServer(handler);
    const sessions = new Set<http2.ServerHttp2Session>();
    server.on("session", (session: http2.ServerHttp2Session) => {
      sessions.add(session);
      session.on("close", () => sessions.delete(session));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    return {
      host: "127.0.0.1",
      port,
      close: () =>
        new Promise<void>((resolve) => {
          for (const session of sessions) session.destroy();
          server.close(() => resolve());
        }),
    };
  }
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    host: "127.0.0.1",
    port,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
