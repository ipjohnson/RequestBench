// RequestBench framework: Fastify, as a Lambda function. The runtime hands each event to
// @fastify/aws-lambda, which injects it into the application and, with payloadAsStream, hands back
// the answer's head and its body as a stream. The handler writes both to the runtime's response
// stream, as the adapter's README shows. The runtime imports a handler's module only as .js, .mjs or
// .cjs, so this one is JavaScript, and Node strips the types of the application as it imports it.
import { pipeline } from "node:stream/promises";

import awsLambdaFastify from "@fastify/aws-lambda";

import { build } from "../Implementation/app.ts";
import { load } from "../Implementation/payloads.ts";

const directory = process.env["RB_PAYLOADS"];
if (directory === undefined) throw new Error("RB_PAYLOADS has to name the payload directory");

const app = await build(load(directory));
const proxy = awsLambdaFastify(app, { payloadAsStream: true });
export const handler = awslambda.streamifyResponse(async (event, responseStream, context) => {
  const { meta, stream } = await proxy(event, context);
  await pipeline(stream, awslambda.HttpResponseStream.from(responseStream, meta));
});
// The plugins load here rather than on the first event. This comes after awsLambdaFastify, which
// decorates the request, as the adapter's README places it.
await app.ready();
