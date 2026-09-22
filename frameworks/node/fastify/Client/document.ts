// Writes the OpenAPI document @fastify/swagger collects from the route schemas, without listening.
import { writeFileSync } from "node:fs";

import swagger from "@fastify/swagger";
import Fastify from "fastify";

import { build } from "../Implementation/app.ts";
import { load } from "../Implementation/payloads.ts";

const directory = process.env["RB_PAYLOADS"];
if (directory === undefined) throw new Error("RB_PAYLOADS has to name the payload directory");

const app = Fastify();
await app.register(swagger, { openapi: { openapi: "3.1.0", info: { title: "Fastify", version: "1.0.0" } } });
await build(load(directory), app);
await app.ready();
writeFileSync(new URL("./openapi.json", import.meta.url), `${JSON.stringify(app.swagger(), null, 2)}\n`);
await app.close();
