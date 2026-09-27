// RequestBench framework: Hono. One process, served by @hono/node-server on node:http2's server, which answers
// HTTP/2 with prior knowledge.
import { createServer } from "node:http2";
import { performance } from "node:perf_hooks";

import { serve } from "@hono/node-server";

import { build } from "../Implementation/app.ts";
import { boot } from "../Implementation/boot.ts";
import { load } from "../Implementation/payloads.ts";

const directory = process.env["RB_PAYLOADS"];
if (directory === undefined) throw new Error("RB_PAYLOADS has to name the payload directory");

const app = build(load(directory));

// hono's streamSSE and streamText set Transfer-Encoding and Connection, which belong to HTTP/1.1.
// node:http2 refuses them with a throw that escapes @hono/node-server's error handler and ends the
// process, so an answer carrying them drops them here. This is honojs/hono#4041.
const fetch: typeof app.fetch = async (request, ...rest) => {
  const response = await app.fetch(request, ...rest);
  if (response.headers.has("transfer-encoding")) {
    response.headers.delete("transfer-encoding");
    response.headers.delete("connection");
  }
  return response;
};

const server = serve({ fetch, createServer, hostname: "0.0.0.0", port: Number(process.env["PORT"] ?? 8080) }, () => {
  // performance.now() counts from the start of the process.
  boot.ms = Math.round(performance.now() * 10) / 10;
});

// As the container's first process, Node has no default action for SIGTERM, and docker stop would
// wait out its timeout.
process.once("SIGTERM", () => void server.close());
