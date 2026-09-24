// RequestBench framework: Fastify, as a Lambda function. The runtime hands each event to
// @fastify/aws-lambda, which injects it into the application. The runtime imports a handler's
// module only as .js, .mjs or .cjs, so this one is JavaScript, and Node strips the types of the
// application as it imports it.
import awsLambdaFastify from "@fastify/aws-lambda";

import { build } from "../Implementation/app.ts";
import { load } from "../Implementation/payloads.ts";

const directory = process.env["RB_PAYLOADS"];
if (directory === undefined) throw new Error("RB_PAYLOADS has to name the payload directory");

const app = await build(load(directory));
export const handler = awsLambdaFastify(app);
// The plugins load here rather than on the first event. This comes after awsLambdaFastify, which
// decorates the request, as the adapter's README places it.
await app.ready();
