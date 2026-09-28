// RequestBench framework: h3, as a Lambda function. The runtime hands each event to srvx's AWS Lambda
// adapter, which turns it into a Request for the application's fetch and writes the answer to the
// runtime's response stream as its body yields it. The runtime imports a handler's module only as
// .js, .mjs or .cjs, so this one is JavaScript, and Node strips the types of the application as it
// imports it.
import { handleLambdaEventWithStream } from "srvx/aws-lambda";

import { build } from "../Implementation/app.ts";
import { load } from "../Implementation/payloads.ts";

const directory = process.env["RB_PAYLOADS"];
if (directory === undefined) throw new Error("RB_PAYLOADS has to name the payload directory");

const app = build(load(directory));
export const handler = awslambda.streamifyResponse((event, responseStream, context) =>
  handleLambdaEventWithStream(app.fetch, event, responseStream, context),
);
