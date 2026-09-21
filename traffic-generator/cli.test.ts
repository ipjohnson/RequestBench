// The generator run as a process against a stub that answers every performance test in the
// corpus the way node:fastify declares it does, and answers 500 to a request that went out
// on the wire wrong.
//
//   node --test traffic-generator/
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { settings } from "@rb/tests/payloads";

const VALUES = {
  one: 4821,
  two: 1375,
  tenant: "qwertyuiopas",
  requestId: "0123456789abcdef",
  account: 482913,
  page: 314,
  size: 27,
  status: "paid",
  category: "garden",
  sort: "created",
  q: "amber ledge",
  minPrice: 1200,
  maxPrice: 48000,
};
const ETAG = '"stub"';
const { token, cors } = settings.value;

type Answer = number | readonly [number, Record<string, string>];
type Route = readonly [RegExp, (m: RegExpExecArray, req: http.IncomingMessage, url: URL, body: string) => Answer];

const id = (text: string | undefined): number => Number(text);

/** query.many's eight names, which forms.urlencoded posts as a form. */
const MANY = ["page", "size", "status", "category", "sort", "q", "minPrice", "maxPrice"] as const;

/** The content type each body goes out with. */
function typed(path: string): RegExp {
  if (path === "/forms/urlencoded") return /^application\/x-www-form-urlencoded$/;
  if (path === "/forms/multipart") return /^multipart\/form-data; boundary=/;
  return /^application\/json$/;
}

/** 400 for a body the parser refuses and for one the validator refuses, as fastify answers both. */
function validated(body: string): Answer {
  let order: unknown;
  try {
    order = JSON.parse(body);
  } catch {
    return 400;
  }
  const o = order as { customerId?: unknown; status?: unknown; lines?: unknown };
  return Number.isInteger(o.customerId) && typeof o.status === "string" && Array.isArray(o.lines) ? 200 : 400;
}

const ROUTES: readonly Route[] = [
  [
    /^GET \/(plaintext|(json|cache|compressed|middleware|template)\/\w+|cache\/vary\/(one|many)|parameters\/static\/segment\/literal)$/,
    () => 200,
  ],
  [/^GET \/authorized\/small$/, (_, req) => (req.headers.authorization === `Bearer ${token}` ? 200 : 403)],
  [/^POST \/body\/bind\/(small|medium)$/, (_, __, ___, body) => (validated(body) === 200 ? 200 : 500)],
  [/^POST \/body\/validate\/(small|medium|first-error)$/, (_, __, ___, body) => validated(body)],
  [/^GET \/etag\/(small|large)$/, (_, req) => (req.headers["if-none-match"] === ETAG ? 304 : [200, { etag: ETAG }])],
  // Host and Connection are two of the five, and of the thirty.
  [/^GET \/headers$/, (_, req) => ([10, 60].includes(req.rawHeaders.length) ? 200 : 500)],
  [/^GET \/headers\/bind$/, (_, req) => {
    const h = req.headers;
    const bound = h["x-rb-tenant"] === VALUES.tenant && h["x-rb-request-id"] === VALUES.requestId;
    return bound && h["x-rb-account"] === String(VALUES.account) ? 200 : 500;
  }],
  [/^GET \/parameters\/(\d+)\/segment\/literal$/, (m) => (id(m[1]) === VALUES.one ? 200 : 500)],
  [/^GET \/parameters\/(\d+)\/with-second\/(\d+)$/, (m) =>
    (id(m[1]) === VALUES.one && id(m[2]) === VALUES.two ? 200 : 500)],
  [/^GET \/query\/one$/, (_, __, url) => (url.searchParams.get("page") === String(VALUES.page) ? 200 : 500)],
  [/^GET \/query\/many$/, (_, req, url) => {
    const q = url.searchParams;
    const ok = MANY.every((name) => q.get(name) === String(VALUES[name])) && req.url!.includes("q=amber%20ledge");
    return ok ? 200 : 500;
  }],
  [/^(?:GET|HEAD) \/items\/(\d+)$/, (m) => (id(m[1]) >= 1 && id(m[1]) <= 1425 ? 200 : 404)],
  [/^POST \/items$/, (_, __, ___, body) => (JSON.parse(body).id === undefined ? 201 : 500)],
  [/^(?:PUT|PATCH) \/items\/\d+$/, (_, __, ___, body) => (body === "" ? 500 : 200)],
  [/^DELETE \/items\/\d+$/, () => 204],
  // Fastify matches the method and the path together, so a method a path lacks is a miss.
  [/^POST \/items\/\d+$/, () => 404],
  [/^OPTIONS \/cors\/small$/, (_, req) => (req.headers.origin === cors.origin ? 204 : 500)],
  [/^GET \/cors\/small$/, (_, req) => (req.headers.origin === cors.origin ? 200 : 500)],
  [/^POST \/forms\/urlencoded$/, (_, __, ___, body) => {
    const form = new URLSearchParams(body);
    return MANY.every((name) => form.get(name) === String(VALUES[name])) ? 200 : 500;
  }],
  [/^POST \/forms\/multipart$/, (_, __, ___, body) => (body.includes(`\r\n\r\n${VALUES.tenant}\r\n`) ? 200 : 500)],
  [/^GET \/(stream\/items|static\/items\.large\.json)$/, () => 200],
];

/** How the stub answers, with any route swapped out for the scenario. */
function stub(override?: (route: string) => Answer | undefined): (req: http.IncomingMessage, body: string) => Answer {
  return (req, body) => {
    const url = new URL(req.url!, "http://stub");
    const route = `${req.method} ${url.pathname}`;
    const swapped = override?.(route);
    if (swapped !== undefined) return swapped;
    if (body !== "") {
      const sized = req.headers["content-length"] === String(Buffer.byteLength(body));
      if (!typed(url.pathname).test(req.headers["content-type"] ?? "") || !sized) return 500;
    }
    for (const [pattern, answer] of ROUTES) {
      const m = pattern.exec(route);
      if (m !== null) return answer(m, req, url, body);
    }
    return 404;
  };
}

let server: http.Server;
let address: string;
let answering = stub();
let delay = 0;

before(async () => {
  server = http.createServer((req, res) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => (body += chunk));
    req.on("end", () => {
      const answer = answering(req, body);
      const [status, headers] = typeof answer === "number" ? [answer, {}] : answer;
      const payload = status === 204 || status === 304 ? undefined : "{}";
      setTimeout(() => res.writeHead(status, headers).end(payload), delay);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  address = `127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => new Promise<void>((resolve) => server.close(() => resolve())));

const CLI = fileURLToPath(new URL("./cli.ts", import.meta.url));
const NODE = process.execArgv.filter((flag) => flag === "--experimental-strip-types" || flag === "--no-warnings");
const OUT = mkdtempSync(join(tmpdir(), "rb-generator-"));

interface Ran {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
  // The result file, which the tests read loosely.
  readonly result: any;
}

let runs = 0;

function generate(...args: string[]): Promise<Ran> {
  const out = join(OUT, `run-${++runs}.json`);
  return new Promise((resolve) => {
    execFile(process.execPath, [...NODE, CLI, address, "--out", out, ...args], (error, stdout, stderr) => {
      const code = error === null ? 0 : typeof error.code === "number" ? error.code : 1;
      let result: unknown;
      try {
        result = JSON.parse(readFileSync(out, "utf8"));
      } catch {
        result = undefined;
      }
      resolve({ code, stdout, stderr, result });
    });
  });
}

const fastify = ["--framework", "node:fastify", "--values", JSON.stringify(VALUES)];

test("every performance test answers the status it declares", async () => {
  answering = stub();
  delay = 0;
  const { code, result, stdout } = await generate(...fastify, "--rps", "300", "--seconds", "2", "--workers", "2");
  assert.equal(code, 0, stdout);
  assert.equal(result.tests_live, 55);
  assert.equal(result.scheduled, 600);
  assert.equal(result.completed, 600, stdout);
  assert.equal(result.status_mismatch, 0, stdout);
  assert.equal(result.errors, 0, stdout);
  assert.equal(result.dropped, 0);
  assert.deepEqual(result.values, VALUES);
  for (const t of result.tests) assert.ok(t.count > 0, `${t.id} ran no instance`);
});

test("a wrong status is counted against the test that received it and still timed", async () => {
  answering = stub((route) => (route === "GET /json/small" ? 500 : undefined));
  delay = 0;
  const { code, result } = await generate(...fastify, "--rps", "300", "--seconds", "2", "--only", "json,baseline");
  assert.equal(code, 0);
  const small = result.tests.find((t: { id: string }) => t.id === "json.small");
  assert.ok(small.count > 0);
  assert.equal(small.mismatch, small.count);
  assert.equal(small.first_mismatch, "GET /json/small answered 500, expected 200");
  assert.equal(result.status_mismatch, small.mismatch);
});

test("an instance due while the in-flight limit is reached is dropped, not sent", async () => {
  answering = stub();
  delay = 300;
  const { code, result } = await generate(
    ...fastify,
    ...["--rps", "100", "--seconds", "1", "--workers", "1", "--max-inflight", "5", "--only", "baseline.plaintext"],
  );
  delay = 0;
  assert.equal(code, 0);
  assert.ok(result.dropped > 0);
  assert.equal(result.completed + result.dropped, result.scheduled);
  assert.ok(result.overall.p50_us >= 300_000);
});

test("slices and the first request are recorded apart", async () => {
  answering = stub();
  delay = 0;
  const { code, result } = await generate(
    ...fastify,
    ...["--rps", "200", "--seconds", "2", "--slices", "1,2", "--first", "json.small"],
  );
  assert.equal(code, 0);
  assert.equal(result.first.test, "json.small");
  assert.equal(result.first.status, 200);
  assert.equal(result.slices.length, 2);
  assert.equal(result.slices[0].count + result.slices[1].count, result.overall.count);
});

test("the settle runs the same schedule unrecorded before the recorded instances", async () => {
  answering = stub();
  delay = 0;
  const { code, result } = await generate(
    ...fastify,
    ...["--rps", "200", "--settle", "1", "--abort-drop-fraction", "0.05", "--seconds", "1", "--slices", "0.5,1"],
  );
  assert.equal(code, 0);
  assert.equal(result.settle.scheduled, 200);
  assert.equal(result.settle.completed, 200);
  assert.equal(result.settle.aborted, false);
  assert.equal(result.scheduled, 200);
  assert.equal(result.completed, 200);
  assert.equal(result.overall.count, 200);
  assert.equal(result.slices[0].count + result.slices[1].count, 200);
});

test("a settle that drops more than it may ends the run without the recorded instances", async () => {
  answering = stub();
  delay = 300;
  const began = Date.now();
  const { code, result, stdout } = await generate(
    ...fastify,
    ...["--rps", "100", "--settle", "1", "--abort-drop-fraction", "0.05", "--seconds", "30"],
    ...["--workers", "1", "--max-inflight", "5", "--only", "baseline.plaintext"],
  );
  delay = 0;
  assert.equal(code, 0, stdout);
  assert.equal(result.settle.aborted, true);
  assert.ok(result.settle.drop_fraction > 0.05);
  assert.equal(result.tests, undefined);
  assert.match(stdout, /more than the 0\.05 allowed, so the recorded 30s were not run/);
  assert.ok(Date.now() - began < 15_000, "the recorded 30 seconds ran anyway");
});

test("a test that needs a once() value cannot go first", async () => {
  const { code, stderr } = await generate(...fastify, "--rps", "10", "--seconds", "1", "--first", "etag.match_large");
  assert.equal(code, 2);
  assert.match(stderr, /--first etag\.match_large reaches once\("\/etag\/large"\)/);
});

test("a test that cannot be sent stops the run before the load", async () => {
  answering = stub((route) => (route === "GET /etag/large" ? 200 : undefined));
  const { code, stderr } = await generate(...fastify, "--rps", "10", "--seconds", "1");
  assert.equal(code, 1);
  assert.match(stderr, /priming etag\.match_large: GET \/etag\/large answered 200 with no etag/);
});

test("arguments are refused before anything is sent", async () => {
  const refused = async (args: string[], message: RegExp) => {
    const { code, stderr } = await generate(...args);
    assert.equal(code, 2, stderr);
    assert.match(stderr, message);
  };
  await refused(["--rps", "10", "--seconds", "1"], /--framework is required/);
  const rate = ["--rps", "10", "--seconds", "1"];
  await refused(["--framework", "go:gin", ...rate], /go:gin has no client-exception declaration/);
  await refused([...fastify, "--seconds", "1"], /--rps is required/);
  const low = ["--framework", "node:fastify", "--values", '{"one":7}', ...rate];
  await refused(low, /one: Number must be greater than or equal to 1000/);
  await refused([...fastify, "--rps", "10", "--seconds", "2", "--slices", "1,3"], /--slices 1,3 has to rise/);
  await refused([...fastify, ...rate, "--only", "nope"], /--only nope is neither a test nor a family/);
  await refused([...fastify, ...rate, "--abort-drop-fraction", "0.05"], /needs --settle/);
});
