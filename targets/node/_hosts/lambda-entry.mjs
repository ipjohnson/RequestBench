// Host: AWS Lambda, native adapter. No HTTP server anywhere in the process.
//
// The Runtime Interface Client hands an API Gateway v2 event straight to the framework's
// own Lambda adapter, which feeds it into the router. That is one fewer hop than the Web
// Adapter, which keeps the framework's HTTP server and reverse-proxies into it.
//
// The bare baseline has no adapter: it reads the event itself, which is what makes it the
// floor for this host rather than a translation of the container one.
import { useAdapter } from "../_shared/host.js";

const target = process.env.RB_TARGET ?? "baseline";
const app = await import(`../${target}/app.js`);

let invoke;
if (app.lambda) {
  invoke = app.lambda;                                  // baseline: native event handler
} else if (target === "fastify") {
  const { default: awsLambdaFastify } = await import("@fastify/aws-lambda");
  invoke = awsLambdaFastify(app.app);
  useAdapter("@fastify/aws-lambda");
} else {
  // handler, not app: serverless-express wants a (req, res) listener, which every target
  // exports and which the Functions Framework is already given. Passing the framework
  // object worked only for Express, whose app is itself a listener.
  const { default: serverlessExpress } = await import("@codegenie/serverless-express");
  invoke = serverlessExpress({ app: app.handler });
  useAdapter("@codegenie/serverless-express");
}

export const handler = (event, context) => invoke(event, context);
