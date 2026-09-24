// RequestBench framework: Fastify. One process, as Fastify's own listen starts it, answering HTTP/2 with prior
// knowledge through Fastify's own http2 option.
import { performance } from "node:perf_hooks";

import Fastify, { type FastifyInstance } from "fastify";

import { build } from "../Implementation/app.ts";
import { boot } from "../Implementation/boot.ts";
import { load } from "../Implementation/payloads.ts";

const directory = process.env["RB_PAYLOADS"];
if (directory === undefined) throw new Error("RB_PAYLOADS has to name the payload directory");

// The application's plugins are typed against Fastify's default server and read nothing of the raw one, so the
// HTTP/2 instance goes in as that type.
const app = await build(load(directory), Fastify({ http2: true }) as unknown as FastifyInstance);
await app.listen({ host: "0.0.0.0", port: Number(process.env["PORT"] ?? 8080) });
// performance.now() counts from the start of the process.
boot.ms = Math.round(performance.now() * 10) / 10;

// As the container's first process, Node has no default action for SIGTERM, and docker stop would
// wait out its timeout.
process.once("SIGTERM", () => void app.close());
