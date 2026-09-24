// RequestBench framework: h3. One process, served by h3's serve(), which runs srvx's Node adapter.
import { performance } from "node:perf_hooks";

import { serve } from "h3";

import { build } from "../Implementation/app.ts";
import { boot } from "../Implementation/boot.ts";
import { load } from "../Implementation/payloads.ts";

const directory = process.env["RB_PAYLOADS"];
if (directory === undefined) throw new Error("RB_PAYLOADS has to name the payload directory");

// As the container's first process, Node has no default action for SIGTERM. srvx's graceful
// shutdown stops the server on SIGTERM itself. It is on by default unless CI or TEST is set, so it
// is asked for here.
const server = serve(build(load(directory)), {
  hostname: "0.0.0.0",
  port: Number(process.env["PORT"] ?? 8080),
  silent: true,
  gracefulShutdown: true,
});
await server.ready();
// performance.now() counts from the start of the process.
boot.ms = Math.round(performance.now() * 10) / 10;
