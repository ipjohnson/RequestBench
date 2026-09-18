// Values drawn once per run: what is drawn, where it goes, and how an echo of it is judged.
//
// The evidence for the echo check is a target that binds what it is sent and targets that
// do not, because a target that ignored its input passes every check that only compares one
// target with another.
import { afterAll, describe, expect, test } from "vitest";
import { createServer, type Server } from "node:http";
import { check } from "../src/expectation.js";
import { gate } from "../src/gate.js";
import type { Expected, Plan } from "../src/spec.js";
import {
  draw, echoProblem, filled, inHeader, inPath, parseValues, type RunValue, type Values,
} from "../src/values.js";

const declared: Record<string, RunValue> = {
  one: { kind: "int", digits: 4 },
  two: { kind: "int", digits: 4 },
  tenant: { kind: "string", length: 12, chars: "abcdefghijklmnopqrstuvwxyz" },
  account: { kind: "int", digits: 6 },
  q: { kind: "words", count: 2, length: 5, chars: "abcdefghijklmnopqrstuvwxyz" },
  status: { kind: "choice", values: ["open", "paid", "shipped", "cancelled"] },
};

const INSTANCES = 4;
const times = (path: string): string[] => Array.from({ length: INSTANCES }, () => path);
const SMALL = { size: "small", count: 1, items: [1] };

const plan: Plan = {
  version: "blend-v2",
  instances: INSTANCES,
  run_values: declared,
  endpoints: [
    {
      id: "parameters.two", family: "parameters", method: "GET", expect: 200,
      paths: times("/parameters/{run.one}/with-second/{run.two}"), echo: ["one", "two"],
    },
    {
      id: "headers.bind_few", family: "headers", method: "GET", expect: 200,
      paths: times("/headers/bind"),
      headers: { "x-rb-tenant": "{run.tenant}", "x-rb-account": "{run.account}" },
      echo: ["tenant", "account"],
    },
    {
      id: "query.many", family: "query", method: "GET", expect: 200,
      paths: times("/query/many?q={run.q}&status={run.status}"), echo: ["q", "status"],
    },
  ],
};

type Faults = {
  /** Answer the same echo whatever was sent. */
  readonly ignoresInput?: boolean;
  /** Echo an int the way it arrived, as a string. */
  readonly stringly?: boolean;
};

const servers: Server[] = [];
/** Every request line a stub target received, as it arrived. */
const received: string[] = [];

/** A target that binds each value where the plan put it and answers the small payload with it. */
async function serve(faults: Faults = {}): Promise<string> {
  const server = createServer((req, res) => {
    received.push(req.url ?? "");
    req.resume();
    req.on("end", () => {
      const url = new URL(req.url ?? "", "http://stub");
      const int = (v: string | undefined | null): number | string =>
        faults.stringly ? String(v) : Number(v);
      let echo: Record<string, unknown> = {};
      const two = /^\/parameters\/([^/]+)\/with-second\/([^/]+)$/.exec(url.pathname);
      if (two) echo = { one: int(two[1]), two: int(two[2]) };
      else if (url.pathname === "/headers/bind") {
        echo = {
          tenant: req.headers["x-rb-tenant"], account: int(req.headers["x-rb-account"] as string),
        };
      } else if (url.pathname === "/query/many") {
        echo = { q: url.searchParams.get("q"), status: url.searchParams.get("status") };
      }
      if (faults.ignoresInput) echo = Object.fromEntries(Object.keys(echo).map((k) => [k, 7]));
      const body = Buffer.from(JSON.stringify({ ...SMALL, echo }));
      res.writeHead(200, { "content-type": "application/json", "content-length": body.length });
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

describe("drawing", () => {
  test("every kind comes out at its declared length and from its declared characters", () => {
    for (let i = 0; i < 50; i++) {
      const v = draw(declared);
      expect(String(v.get("one"))).toMatch(/^[1-9][0-9]{3}$/);
      expect(v.get("tenant")).toMatch(/^[a-z]{12}$/);
      expect(String(v.get("account"))).toMatch(/^[1-9][0-9]{5}$/);
      // Exactly one space and never at either end, so no framework can trim it away.
      expect(v.get("q")).toMatch(/^[a-z]{5} [a-z]{5}$/);
      expect(["open", "paid", "shipped", "cancelled"]).toContain(v.get("status"));
    }
  });

  test("an int is a number and everything else a string", () => {
    const v = draw(declared);
    expect(typeof v.get("one")).toBe("number");
    expect(typeof v.get("status")).toBe("string");
  });

  test("values passed in are checked against the declarations", () => {
    const good = '{"one":1234,"two":5678,"tenant":"abcdefghijkl","account":123456,'
      + '"q":"abcde fghij","status":"open"}';
    expect(parseValues(good, declared).get("one")).toBe(1234);
    expect(() => parseValues(good.replace("1234", '"1234"'), declared)).toThrow(/one is "1234"/);
    expect(() => parseValues('{"one":1}', declared)).toThrow(/two is undefined/);
    expect(() => parseValues(good.replace("{", '{"three":3,'), declared)).toThrow(/three/);
  });
});

describe("where a value goes", () => {
  const values: Values = new Map<string, number | string>([["q", "abcde fghij"], ["one", 1234]]);

  test("into a URL it is percent-encoded, with a space as %20 and never +", () => {
    expect(inPath("/query/many?q={run.q}&one={run.one}", values))
      .toBe("/query/many?q=abcde%20fghij&one=1234");
  });

  test("into a header it goes as it is", () => {
    expect(inHeader("{run.q}", values)).toBe("abcde fghij");
  });

  test("an expected body gets an int back as a number", () => {
    const body = { size: "small", echo: { one: "{run.one}", q: "{run.q}" }, note: "{run.q} x" };
    expect(filled(body, values)).toEqual({
      size: "small", echo: { one: 1234, q: "abcde fghij" }, note: "{run.q} x",
    });
  });

  test("an echo is held to exactly the names and the values sent", () => {
    expect(echoProblem(["one"], { echo: { one: 1234 } }, values)).toBeNull();
    expect(echoProblem(["one"], { echo: { one: "1234" } }, values))
      .toBe('echo.one: 1234 was sent, "1234" came back');
    expect(echoProblem(["one"], { echo: {} }, values)).toBe("echo.one: 1234 was sent and not echoed");
    expect(echoProblem(["one"], { echo: { one: 1234, q: "x" } }, values))
      .toBe("echo.q: nothing by that name was sent");
    expect(echoProblem(["one"], { one: 1234 }, values)).toMatch(/^no echo object/);
  });
});

describe("the gate", () => {
  test("a target that binds what it is sent passes, and what it was sent is this run's", async () => {
    received.length = 0;
    const values = draw(declared);
    const r = await gate(plan, await serve(), "node:fastify", { values });
    expect(r.endpoints.filter((e) => !e.ok)).toEqual([]);
    const q = received.find((u) => u.startsWith("/query/many"));
    expect(q).toBe(`/query/many?q=${String(values.get("q")).replace(" ", "%20")}`
      + `&status=${String(values.get("status"))}`);
  });

  test("an anchor that ignores its input fails on its own, with nothing to compare against", async () => {
    const r = await gate(plan, await serve({ ignoresInput: true }), "node:fastify");
    const failed = r.endpoints.filter((e) => !e.ok);
    expect(failed.map((e) => e.id)).toEqual(["parameters.two", "headers.bind_few", "query.many"]);
    expect(failed[0]?.why).toMatch(/^echo\.one: \d{4} was sent, 7 came back$/);
  });

  test("an int echoed as a string is not the int that was sent", async () => {
    const r = await gate(plan, await serve({ stringly: true }), "node:fastify");
    expect(r.endpoints.find((e) => e.id === "headers.bind_few")?.why)
      .toMatch(/^echo\.account: \d{6} was sent, "\d{6}" came back$/);
  });

  test("targets sent the same values are compared by the path the plan writes", async () => {
    const values = draw(declared);
    const anchor = await gate(plan, await serve(), "node:fastify", { values });
    expect(Object.keys(anchor.responses)).toContain(
      "parameters.two /parameters/{run.one}/with-second/{run.two}");
    const other = await gate(plan, await serve(), "node:express", {
      values, reference: anchor.responses,
    });
    expect(other.drift).toEqual([]);
    expect(other.compared).toBe(3);
  });
});

describe("against the committed expectation", () => {
  const expected: Expected = {
    version: "expected-v2", blend: "blend-v2", plan: "sha256:unused", fixture: "sha256:unused",
    agreed_by: ["node:fastify"], unpinned: {}, errors: {}, targets: {},
    requests: {
      "parameters.two /parameters/{run.one}/with-second/{run.two}": {
        status: 200, body_class: "json", encoding: "",
        body: { ...SMALL, echo: { one: "{run.one}", two: "{run.two}" } },
      },
      "headers.bind_few /headers/bind": {
        status: 200, body_class: "json", encoding: "",
        body: { ...SMALL, echo: { tenant: "{run.tenant}", account: "{run.account}" } },
      },
      "query.many /query/many?q={run.q}&status={run.status}": {
        status: 200, body_class: "json", encoding: "",
        body: { ...SMALL, echo: { q: "{run.q}", status: "{run.status}" } },
      },
    },
  };

  test("the pinned placeholders are filled with the values sent before comparing", async () => {
    const r = await check(plan, expected, await serve(), "node:fastify");
    expect(r.endpoints.filter((e) => !e.ok)).toEqual([]);
    expect(r.endpoints.map((e) => e.total)).toEqual([1, 1, 1]);
  });

  test("and a target that ignored them does not answer the expectation", async () => {
    const r = await check(plan, expected, await serve({ ignoresInput: true }), "node:fastify");
    expect(r.endpoints.find((e) => e.id === "parameters.two")?.problems[0])
      .toMatch(/^response\.echo\.one: 7 vs \d{4}$/);
  });
});
