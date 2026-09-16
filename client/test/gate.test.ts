// The gate against two frameworks whose error envelopes genuinely differ.
//
// Both conform, and neither is reported as drifting from the other. A body outside an error
// endpoint still is, which is what keeps this from being a comparison quietly switched off.
import { afterAll, describe, expect, test } from "vitest";
import { createServer, type Server } from "node:http";
import { gate } from "../src/gate.js";
import type { Plan } from "../src/spec.js";

/**
 * Seven endpoints with the real ids, because the id is what selects a framework's schema,
 * and one path each, because what is under test is the branch and not the plan.
 */
const plan: Plan = {
  version: "blend-v2",
  instances: 1,
  endpoints: [
    { id: "baseline.plaintext", family: "baseline", method: "GET", expect: 200, paths: ["/plaintext"] },
    { id: "authorized.denied", family: "authorized", method: "GET", expect: 403, paths: ["/authorized/small"] },
    { id: "errors.not_found", family: "errors", method: "GET", expect: 404, paths: ["/domain/orders/999999"] },
    { id: "errors.unmatched", family: "errors", method: "GET", expect: 404, paths: ["/errors/unmatched"] },
    {
      id: "body.rejected_all", family: "body", method: "POST", expect: 422,
      paths: ["/body/validate/small"], body: '{"customer_id":"x","status":1,"lines":"no"}',
      field_errors: [["customer_id", "int"], ["status", "string"], ["lines", "array"]],
    },
    {
      id: "body.rejected_first", family: "body", method: "POST", expect: 422,
      paths: ["/body/validate/first-error"], body: '{"customer_id":"x"}',
      field_errors: [["customer_id", "int"]],
    },
    {
      id: "errors.malformed", family: "errors", method: "POST", expect: 400, accepts: [400, 422],
      paths: ["/errors/malformed"], body: "{",
    },
  ],
};

const pairs = { customer_id: ["int"], status: ["string"], lines: ["array"] };

/** What ASP.NET MVC answers: RFC 7807 throughout, and a bare status on the 403. */
const problemDetails: Record<string, [number, unknown]> = {
  "/plaintext": [200, "Hello, World!"],
  "/authorized/small": [403, { status: 403 }],
  "/domain/orders/999999": [404, { type: "about:blank", title: "Not Found", status: 404 }],
  "/errors/unmatched": [404, { type: "about:blank", title: "Not Found", status: 404 }],
  "/body/validate/small": [422, { type: "about:blank", title: "Invalid", status: 422, errors: pairs }],
  "/body/validate/first-error": [422, { type: "about:blank", title: "Invalid", status: 422, errors: { customer_id: ["int"] } }],
  "/errors/malformed": [400, { type: "about:blank", title: "Bad", status: 400, traceId: "00-a-01", errors: { $: ["json"] } }],
};

/** What FastEndpoints answers: its own ErrorResponse, and the host's 404 on an unclaimed route. */
const errorResponse: Record<string, [number, unknown]> = {
  "/plaintext": [200, "Hello, World!"],
  "/authorized/small": [403, { message: "Forbidden", statusCode: 403 }],
  "/domain/orders/999999": [404, { message: "Not Found", statusCode: 404 }],
  "/errors/unmatched": [404, { error: "not_found" }],
  "/body/validate/small": [422, { message: "One or more errors occurred!", status_code: 422, errors: pairs }],
  "/body/validate/first-error": [422, { message: "One or more errors occurred!", status_code: 422, errors: { customer_id: ["int"] } }],
  "/errors/malformed": [422, { message: "One or more errors occurred!", status_code: 422, errors: { body: ["json"] } }],
};

const servers: Server[] = [];

async function serve(routes: Record<string, [number, unknown]>): Promise<string> {
  const server = createServer((req, res) => {
    const path = (req.url ?? "").split("?")[0] ?? "";
    req.resume();
    req.on("end", () => {
      if (path === "/__meta") {
        const meta = Buffer.from("{}");
        res.writeHead(200, { "content-type": "application/json", "content-length": meta.length });
        return res.end(meta);
      }
      const route = routes[path];
      if (!route) {
        res.writeHead(404, { "content-type": "application/json", "content-length": 2 });
        return res.end("{}");
      }
      const [status, value] = route;
      const isText = typeof value === "string";
      const body = Buffer.from(isText ? value : JSON.stringify(value));
      res.writeHead(status, {
        "content-type": isText ? "text/plain" : "application/json",
        "content-length": body.length,
      });
      res.end(body);
    });
  });
  servers.push(server);
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("no port");
  return `127.0.0.1:${address.port}`;
}

afterAll(() => { for (const s of servers) s.close(); });

describe("two frameworks, two envelopes", () => {
  test("each conforms against its own contract", async () => {
    const mvc = await gate(plan, await serve(problemDetails), "dotnet:aspnet-mvc");
    const fe = await gate(plan, await serve(errorResponse), "dotnet:fastendpoints");
    expect(mvc.endpoints.filter((e) => !e.ok)).toEqual([]);
    expect(fe.endpoints.filter((e) => !e.ok)).toEqual([]);
  });

  test("neither drifts from the other, which is the whole point", async () => {
    const reference = await gate(plan, await serve(problemDetails), "dotnet:aspnet-mvc");
    const compared = await gate(plan, await serve(errorResponse), "dotnet:fastendpoints", {
      reference: reference.responses,
    });
    expect(compared.drift).toEqual([]);
    expect(compared.endpoints.filter((e) => !e.ok)).toEqual([]);
  });

  test("a body outside an error endpoint still drifts", async () => {
    const changed = { ...errorResponse, "/plaintext": [200, "Hello, Mars!"] as [number, unknown] };
    const reference = await gate(plan, await serve(problemDetails), "dotnet:aspnet-mvc");
    const compared = await gate(plan, await serve(changed), "dotnet:fastendpoints", {
      reference: reference.responses,
    });
    expect(compared.drift.map(([id]) => id)).toEqual(["baseline.plaintext"]);
  });

  test("the wrong envelope for the target fails, so the check is not vacuous", async () => {
    const wrong = await gate(plan, await serve(errorResponse), "dotnet:aspnet-mvc");
    const failed = wrong.endpoints.filter((e) => !e.ok).map((e) => e.id);
    expect(failed).toEqual([
      "authorized.denied", "errors.not_found", "errors.unmatched",
      "body.rejected_all", "body.rejected_first", "errors.malformed",
    ]);
    // The failure says what was missing and prints what arrived, so the reader can tell a
    // target that changed from a schema that was written wrong.
    expect(wrong.endpoints.find((e) => e.id === "authorized.denied")?.why)
      .toBe("body.status: Required (answered message:string, statusCode:number)");
  });

  test("a status the framework never declared still fails, through the schema", async () => {
    const broken = { ...problemDetails, "/domain/orders/999999": [500, { type: "about:blank", title: "Server Error", status: 500 }] as [number, unknown] };
    const result = await gate(plan, await serve(broken), "dotnet:aspnet-mvc");
    expect(result.endpoints.find((e) => e.id === "errors.not_found")?.why)
      .toContain("expected 404, got 500");
  });

  test("a target with no client-exception package cannot be gated", async () => {
    const result = await gate(plan, await serve(problemDetails), "go:huma");
    expect(result.endpoints.find((e) => e.id === "errors.not_found")?.why)
      .toContain("declares no error contract");
  });
});
