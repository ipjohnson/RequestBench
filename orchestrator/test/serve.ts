// A Transport served over a real socket, so the reference can stand in for a framework that is
// running: the live transport, the gate and the orchestrator all reach it the way they reach one.
import http from "node:http";
import type { AddressInfo } from "node:net";

import type { Transport } from "../validate.ts";

export interface Served {
  readonly host: string;
  readonly port: number;
  close(): Promise<void>;
}

export async function serve(transport: Transport): Promise<Served> {
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const headers: Record<string, string> = {};
      for (const [name, value] of Object.entries(req.headers)) {
        if (value !== undefined) headers[name] = Array.isArray(value) ? value.join(", ") : value;
      }
      transport({
        method: (req.method ?? "GET") as Parameters<Transport>[0]["method"],
        target: req.url ?? "/",
        headers,
        body: chunks.length === 0 ? undefined : Buffer.concat(chunks).toString("utf8"),
      }).then(
        (answer) => {
          res.writeHead(answer.status, answer.headers);
          res.end(Buffer.from(answer.body));
        },
        (error: unknown) => {
          res.writeHead(500, { "content-type": "text/plain" });
          res.end(String(error));
        },
      );
    });
  });
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
