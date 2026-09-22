import type { Routes } from "../app.ts";
import { answers, payload } from "../schemas.ts";

/** json: a payload the framework already holds, written by the function its response schema compiled to. */
const json: Routes = async (app, { payloads: p }) => {
  app.get("/json/small", answers(payload), async () => p.small);

  app.get("/json/medium", answers(payload), async () => p.medium);

  app.get("/json/large", answers(payload), async () => p.large);
};

export default json;
