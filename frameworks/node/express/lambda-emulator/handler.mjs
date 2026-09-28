// RequestBench framework: Express, as a Lambda function. The runtime hands each event to
// @h4ad/serverless-adapter, which passes the application a request and a response of its own and
// answers with the whole of what it wrote. The runtime imports a handler's module only as .js,
// .mjs or .cjs, so this one is JavaScript, and Node strips the types of the application as it
// imports it.
import { ServerlessAdapter } from "@h4ad/serverless-adapter";
import { ApiGatewayV2Adapter } from "@h4ad/serverless-adapter/adapters/aws";
import { ExpressFramework } from "@h4ad/serverless-adapter/frameworks/express";
import { DefaultHandler } from "@h4ad/serverless-adapter/handlers/default";
import { PromiseResolver } from "@h4ad/serverless-adapter/resolvers/promise";

import { build } from "../Implementation/app.ts";
import { load } from "../Implementation/payloads.ts";

const directory = process.env["RB_PAYLOADS"];
if (directory === undefined) throw new Error("RB_PAYLOADS has to name the payload directory");

// As the adapter's usage guide sets it up: ApiGatewayV2Adapter reads the payload format 2.0 event
// a Function URL sends.
const adapter = ServerlessAdapter.new(build(load(directory)))
  .setFramework(new ExpressFramework())
  .setHandler(new DefaultHandler())
  .setResolver(new PromiseResolver())
  .addAdapter(new ApiGatewayV2Adapter())
  .build();

// The runtime refuses a handler that takes a third parameter, the callback, from Node 24 on, and
// the adapter's handler takes one. PromiseResolver never calls it and answers through the promise.
export const handler = (event, context) => adapter(event, context);
