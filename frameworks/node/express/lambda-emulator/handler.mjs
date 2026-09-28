// RequestBench framework: Express, as a Lambda function. The runtime hands each event to
// @codegenie/serverless-express, which passes the application a request and a response of its own.
// The runtime imports a handler's module only as .js, .mjs or .cjs, so this one is JavaScript, and
// Node strips the types of the application as it imports it.
import serverlessExpress from "@codegenie/serverless-express";

import { build } from "../Implementation/app.ts";
import { load } from "../Implementation/payloads.ts";

const directory = process.env["RB_PAYLOADS"];
if (directory === undefined) throw new Error("RB_PAYLOADS has to name the payload directory");

export const handler = serverlessExpress({ app: build(load(directory)) });
