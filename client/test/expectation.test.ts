// The expectation authority: a target against spec/expected.json, never against another
// target. Ported from tests/_family.py along with the code it checks.
import { afterAll, describe, expect, test } from "vitest";
import { createServer, type Server } from "node:http";
import { check, difference } from "../src/expectation.js";
import type { Expected, ExpectedRequest, Plan } from "../src/spec.js";
import type { Answer } from "@rb/schema";

const plan: Plan = {
  version: "blend-v2",
  instances: 1,
  endpoints: [
    { id: "json.small", family: "json", method: "GET", expect: 200, paths: ["/json/small"] },
    {
      id: "compressed.gzip_small", family: "compressed", method: "GET", expect: 200,
      paths: ["/compressed/gzip/small"],
    },
    { id: "errors.not_found", family: "errors", method: "GET", expect: 404, paths: ["/domain/orders/999999"] },
  ],
};

const expected: Expected = {
  version: "expected-v1",
  blend: "blend-v2",
  plan: "sha256:unused",
  fixture: "sha256:unused",
  agreed_by: ["node:fastify"],
  unpinned: {},
  errors: { "errors.not_found": { statuses: [404], field_errors: [] } },
  requests: {
    "json.small /json/small": {
      status: 200, body_class: "json", encoding: "", body: { id: 1, name: "Ada" },
    },
    // The encoding is deliberately not pinned here: whether a target compresses a small
    // body is a framework property the endpoint set exists to show.
    "compressed.gzip_small /compressed/gzip/small": {
      status: 200, body_class: "json", encoding: null, body: { id: 2 },
    },
  },
  targets: {},
};

const servers: Server[] = [];

async function serve(routes: Record<string, [number, string, string]>): Promise<string> {
  const server = createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      const route = routes[(req.url ?? "").split("?")[0] ?? ""];
      if (!route) { res.writeHead(404, { "content-type": "application/json", "content-length": 2 }); return res.end("{}"); }
      const [status, ctype, text] = route;
      const body = Buffer.from(text);
      res.writeHead(status, { "content-type": ctype, "content-length": body.length });
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

const right: Record<string, [number, string, string]> = {
  "/json/small": [200, "application/json", '{"id":1,"name":"Ada"}'],
  "/compressed/gzip/small": [200, "application/json", '{"id":2}'],
  "/domain/orders/999999": [404, "application/json", '{"error":"not_found"}'],
};

describe("against the committed expectation", () => {
  test("a target that answers it passes every endpoint", async () => {
    const r = await check(plan, expected, await serve(right), "go:gin");
    expect(r.endpoints.filter((e) => !e.ok)).toEqual([]);
  });

  test("a body that differs fails, and the complaint names the field", async () => {
    const wrong = { ...right, "/json/small": [200, "application/json", '{"id":1,"name":"Grace"}'] as [number, string, string] };
    const r = await check(plan, expected, await serve(wrong), "go:gin");
    const bad = r.endpoints.find((e) => e.id === "json.small")!;
    expect(bad.ok).toBe(false);
    expect(bad.problems).toEqual(["response.name: 'Grace' vs 'Ada'"]);
  });

  test("an error endpoint is judged by the framework's package, not by the file", async () => {
    // go:gin declares {error: string}. dotnet:carter declares ProblemDetails, so the same
    // response is right for one and wrong for the other, which is the whole point.
    const hostport = await serve(right);
    expect((await check(plan, expected, hostport, "go:gin"))
      .endpoints.find((e) => e.id === "errors.not_found")!.ok).toBe(true);
    const carter = (await check(plan, expected, hostport, "dotnet:carter"))
      .endpoints.find((e) => e.id === "errors.not_found")!;
    expect(carter.ok).toBe(false);
    expect(carter.problems[0]).toBe("body.type: Required (answered error:string)");
  });

  test("each distinct request is asked once, not once per instance", async () => {
    const repeated: Plan = {
      ...plan,
      endpoints: [{ ...plan.endpoints[0]!, paths: ["/json/small", "/json/small", "/json/small"] }],
    };
    const r = await check(repeated, expected, await serve(right), "go:gin");
    expect(r.sent).toBe(1);
  });
});

describe("difference", () => {
  const want = (over: Partial<ExpectedRequest> = {}): ExpectedRequest =>
    ({ status: 200, body_class: "json", encoding: "", body: { a: 1 }, ...over });
  const got = (over: Partial<Answer> = {}): Answer =>
    ({ status: 200, body_class: "json", encoding: "", body: { a: 1 }, ...over });

  test("the status is checked before the body", () => {
    expect(difference(want(), got({ status: 500, body: { a: 2 } })))
      .toBe("expected 200, got 500");
  });

  test("right values with the wrong content-type is not answering correctly", () => {
    expect(difference(want(), got({ body_class: "text" })))
      .toBe("expected a json body, got text");
  });

  test("a target that quietly stopped compressing is caught", () => {
    expect(difference(want({ encoding: "gzip" }), got({ encoding: "" })))
      .toBe("expected content-encoding gzip, got identity");
  });

  test("a null encoding is a field the expectation does not pin", () => {
    expect(difference(want({ encoding: null }), got({ encoding: "gzip" }))).toBeNull();
    expect(difference(want({ encoding: null }), got({ encoding: "" }))).toBeNull();
  });

  test("an answer that matches is null", () => {
    expect(difference(want(), got())).toBeNull();
  });
});
