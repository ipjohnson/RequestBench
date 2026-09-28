// RequestBench framework: Express, as a Lambda function. The runtime hands each event to
// @h4ad/serverless-adapter's AwsStreamHandler, which passes the application a request and a response
// of its own and writes the answer to the runtime's response stream as the application writes it.
// The runtime imports a handler's module only as .js, .mjs or .cjs, so this one is JavaScript, and
// Node strips the types of the application as it imports it.
import { ServerlessAdapter } from "@h4ad/serverless-adapter";
import { ApiGatewayV2Adapter } from "@h4ad/serverless-adapter/adapters/aws";
import { ExpressFramework } from "@h4ad/serverless-adapter/frameworks/express";
import { AwsStreamHandler } from "@h4ad/serverless-adapter/handlers/aws";
import { DummyResolver } from "@h4ad/serverless-adapter/resolvers/dummy";

import { build } from "../Implementation/app.ts";
import { load } from "../Implementation/payloads.ts";

const directory = process.env["RB_PAYLOADS"];
if (directory === undefined) throw new Error("RB_PAYLOADS has to name the payload directory");

// The adapter's documentation pairs AwsStreamHandler with DummyResolver, which it never calls, and
// ApiGatewayV2Adapter, which reads the payload format 2.0 event a Function URL sends.
export const handler = ServerlessAdapter.new(build(load(directory)))
  .setFramework(new ExpressFramework())
  .setHandler(new AwsStreamHandler())
  .setResolver(new DummyResolver())
  .addAdapter(new ApiGatewayV2Adapter())
  .build();
