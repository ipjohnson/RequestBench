// RequestBench framework: h3, as a Lambda function. The runtime hands each event to srvx's AWS Lambda
// adapter, which turns it into a Request for the application's fetch. The runtime imports a
// handler's module only as .js, .mjs or .cjs, so this one is JavaScript, and Node strips the types
// of the application as it imports it.
import { toLambdaHandler } from "srvx/aws-lambda";

import { build } from "../Implementation/app.ts";
import { load } from "../Implementation/payloads.ts";

const directory = process.env["RB_PAYLOADS"];
if (directory === undefined) throw new Error("RB_PAYLOADS has to name the payload directory");

export const handler = toLambdaHandler({ fetch: build(load(directory)).fetch });
