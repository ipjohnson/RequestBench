// Host: GCP Functions Framework, the same library Cloud Run and Functions gen2 run.
//
// The framework contributes only its routing; the Functions Framework brings the server,
// its own body parsing and its own middleware. That layering is the thing being measured,
// so it is left exactly as a deployment would have it.
import { http } from "@google-cloud/functions-framework";
import { useAdapter } from "../_shared/host.js";

useAdapter("@google-cloud/functions-framework");

const target = process.env.RB_TARGET ?? "baseline";
const app = await import(`../${target}/app.js`);

http("rb", (req, res) => app.handler(req, res));
