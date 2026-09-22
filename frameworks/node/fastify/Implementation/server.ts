// RequestBench framework: Fastify. One process, as Fastify's own listen starts it.
import { performance } from "node:perf_hooks";

import { build } from "./app.ts";
import { boot } from "./boot.ts";
import { load } from "./payloads.ts";

const directory = process.env["RB_PAYLOADS"];
if (directory === undefined) throw new Error("RB_PAYLOADS has to name the payload directory");

const app = await build(load(directory));
await app.listen({ host: "0.0.0.0", port: Number(process.env["PORT"] ?? 8080) });
// performance.now() counts from the start of the process.
boot.ms = Math.round(performance.now() * 10) / 10;

// As the container's first process, Node has no default action for SIGTERM, and docker stop would
// wait out its timeout.
process.once("SIGTERM", () => void app.close());
