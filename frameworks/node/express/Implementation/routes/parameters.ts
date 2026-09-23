import type { Routes } from "../app.ts";

/**
 * parameters: router captures, each echoed back as an integer. Express's router captures a segment
 * as a string and converts nothing, so the handler converts it. The router tries routes in the order
 * they were registered, so the static path is registered before the capture that also matches it.
 */
const parameters: Routes = (app, p) => {
  app.get("/parameters/static/segment/literal", (_request, response) => response.json(p.small));

  app.get("/parameters/:one/segment/literal", (request, response) =>
    response.json({ ...p.small, echo: { one: Number(request.params.one) } }));

  app.get("/parameters/:one/with-second/:two", (request, response) =>
    response.json({ ...p.small, echo: { one: Number(request.params.one), two: Number(request.params.two) } }));
};

export default parameters;
