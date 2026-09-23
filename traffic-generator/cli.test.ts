// The generator run as a process against a stub that answers every performance test in the
// corpus the way node:fastify declares it does, and answers 500 to a request that went out
// on the wire wrong.
//
//   node --experimental-strip-types --test traffic-generator/cli.test.ts
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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

type Answer = number | readonly [number, Record<string, string>] | readonly [number, Record<string, string>, string];
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

/** 400 for a body the parser refuses and for one that breaks orderRequest's rules, as fastify answers both. */
function validated(body: string): Answer {
  let order: unknown;
  try {
    order = JSON.parse(body);
  } catch {
    return 400;
  }
  const o = order as { customerId?: unknown; status?: unknown; lines?: unknown };
  const valid = Number.isInteger(o.customerId) && (o.customerId as number) > 0 && typeof o.status === "string" && o.status !== "" &&
    Array.isArray(o.lines) && o.lines.length > 0;
  return valid ? 200 : 400;
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
  [/^GET \/sse\/medium$/, (_, req) => (req.headers.accept === "text/event-stream" ? 200 : 500)],
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
      const [status, headers, sent] = typeof answer === "number" ? [answer, {}, undefined] : answer;
      const payload = status === 204 || status === 304 ? undefined : (sent ?? "{}");
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
    execFile(process.execPath, [...NODE, CLI, "--out", out, ...args], (error, stdout, stderr) => {
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

/** A load against the stub as node:fastify with the values the stub checks, as the one argument. */
const load = (phases: readonly object[], rest: object = {}): string =>
  JSON.stringify({ target: address, framework: "node:fastify", values: VALUES, ...rest, phases });

test("every performance test answers the status it declares", async () => {
  answering = stub();
  delay = 0;
  const { code, result, stdout } = await generate(load([{ name: "regular", rps: 300, seconds: 2 }], { workers: 2 }));
  assert.equal(code, 0, stdout);
  assert.equal(result.testsLive, 56);
  assert.deepEqual(result.load.values, VALUES);
  const [regular] = result.phases;
  assert.equal(regular.status, "done");
  assert.equal(regular.recorded.scheduled, 600);
  assert.equal(regular.recorded.completed, 600, stdout);
  assert.equal(regular.recorded.mismatch, 0, stdout);
  assert.equal(regular.recorded.errors, 0, stdout);
  assert.equal(regular.recorded.dropped, 0);
  for (const t of regular.recorded.tests) assert.ok(t.count > 0, `${t.id} ran no instance`);
});

test("a wrong status is counted against the test that received it and still timed", async () => {
  answering = stub((route) => (route === "GET /json/small" ? 500 : undefined));
  delay = 0;
  const { code, result } = await generate(load([{ name: "regular", rps: 300, seconds: 2 }], { only: ["json", "baseline"] }));
  assert.equal(code, 0);
  const { recorded } = result.phases[0];
  const small = recorded.tests.find((t: { id: string }) => t.id === "json.small");
  assert.ok(small.count > 0);
  assert.equal(small.mismatch, small.count);
  assert.equal(small.firstMismatch, "GET /json/small answered 500, expected 200");
  assert.equal(recorded.mismatch, small.mismatch);
});

test("an answer that is not the length it was primed with is counted as a mismatch", async () => {
  // Priming sees the body the row is measured against, and every answer after it has grown.
  let seen = 0;
  answering = stub((route) => (route === "GET /json/small" && seen++ > 0 ? [200, {}, '{"grew":true}'] : undefined));
  delay = 0;
  const { code, result } = await generate(load([{ name: "regular", rps: 300, seconds: 2 }], { only: ["json.small"] }));
  assert.equal(code, 0);
  const { recorded } = result.phases[0];
  const small = recorded.tests.find((t: { id: string }) => t.id === "json.small");
  assert.equal(small.mismatch, small.count);
  assert.equal(small.firstMismatch, "GET /json/small answered 13 bytes, expected 2");
});

test("a framework that closes the connection with an answer still gets every instance", async () => {
  // Micronaut answers every HEAD with connection: close, as this stub does here.
  answering = stub((route) => (route.startsWith("HEAD /items/") ? [200, { connection: "close" }] : undefined));
  delay = 0;
  const { code, result } = await generate(
    load([{ name: "regular", rps: 200, seconds: 2 }], { workers: 1, connections: 4, only: ["items.head", "items.read"] }),
  );
  answering = stub();
  assert.equal(code, 0);
  const { recorded } = result.phases[0];
  assert.equal(recorded.completed, recorded.scheduled);
  assert.equal(recorded.errors, 0);
  assert.equal(recorded.mismatch, 0);
  for (const t of recorded.tests) assert.ok(t.count > 0, `${t.id} ran no instance`);
});

test("an instance due while the in-flight limit is reached is dropped, not sent", async () => {
  answering = stub();
  delay = 300;
  const { code, result } = await generate(
    load([{ name: "regular", rps: 100, seconds: 1 }], { workers: 1, connections: 5, only: ["baseline.plaintext"] }),
  );
  delay = 0;
  assert.equal(code, 0);
  const { recorded } = result.phases[0];
  assert.ok(recorded.dropped > 0);
  assert.equal(recorded.completed + recorded.dropped, recorded.scheduled);
  // A percentile reads as its bucket's midpoint, and a bucket is 2% wide, so 300 ms can read as 297.9.
  assert.ok(recorded.overall.p50Us >= 300_000 / 1.02);
});

test("phases run in order, a settle is never recorded, and a phase with only a settle records nothing", async () => {
  answering = stub();
  delay = 0;
  const file = join(OUT, "load.json");
  writeFileSync(
    file,
    load([
      { name: "warmup", rps: 200, settle: 1 },
      { name: "regular", rps: 100, settle: 1, abortDropFraction: 0.05, seconds: 1 },
    ]),
  );
  const { code, result, stdout } = await generate(file);
  assert.equal(code, 0, stdout);
  const [warmup, regular] = result.phases;
  assert.equal(warmup.name, "warmup");
  assert.equal(warmup.status, "done");
  assert.equal(warmup.settle.scheduled, 200);
  assert.equal(warmup.settle.completed, 200);
  assert.equal(warmup.recorded, undefined);
  assert.equal(regular.name, "regular");
  assert.equal(regular.status, "done");
  assert.equal(regular.settle.scheduled, 100);
  assert.equal(regular.settle.completed, 100);
  assert.equal(regular.recorded.scheduled, 100);
  assert.equal(regular.recorded.completed, 100);
  assert.equal(regular.recorded.overall.count, 100);
});

test("a settle that drops more than it may ends the load, and the phases after it are not run", async () => {
  answering = stub();
  delay = 300;
  const began = Date.now();
  const { code, result, stdout } = await generate(
    load(
      [
        { name: "raised", rps: 100, settle: 1, abortDropFraction: 0.05, seconds: 30 },
        { name: "peak", rps: 200, settle: 1, seconds: 30 },
      ],
      { workers: 1, connections: 5, only: ["baseline.plaintext"] },
    ),
  );
  delay = 0;
  assert.equal(code, 0, stdout);
  const [raised, peak] = result.phases;
  assert.equal(raised.status, "aborted");
  assert.ok(raised.settle.dropFraction > 0.05);
  assert.equal(raised.recorded, undefined);
  assert.deepEqual(peak, { name: "peak", rps: 200, status: "notRun" });
  assert.match(stdout, /more than the 0\.05 allowed, so the load ends here/);
  assert.ok(Date.now() - began < 15_000, "a recorded 30 seconds ran anyway");
});

test("the result is written after every phase", async () => {
  answering = stub();
  delay = 0;
  const out = join(OUT, "partial.json");
  const phases = [
    { name: "first", rps: 100, seconds: 1 },
    { name: "second", rps: 100, seconds: 30 },
  ];
  const child = execFile(process.execPath, [...NODE, CLI, "--out", out, load(phases)]);
  const exited = new Promise((resolve) => child.on("exit", resolve));
  let written: any;
  for (let waited = 0; written === undefined && waited < 20_000; waited += 100) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    try {
      written = JSON.parse(readFileSync(out, "utf8"));
    } catch {
      // not written yet
    }
  }
  child.kill();
  await exited;
  assert.ok(written !== undefined, "nothing was written while the second phase ran");
  assert.deepEqual(
    written.phases.map((p: { name: string }) => p.name),
    ["first"],
  );
  assert.equal(written.phases[0].recorded.completed, 100);
});

test("a test that cannot be sent stops the load before any phase", async () => {
  answering = stub((route) => (route === "GET /etag/large" ? 200 : undefined));
  const { code, stderr } = await generate(load([{ name: "regular", rps: 10, seconds: 1 }]));
  assert.equal(code, 1);
  assert.match(stderr, /priming etag\.match_large: GET \/etag\/large answered 200 with no etag/);
});

test("a load is refused before anything is sent", async () => {
  const refused = async (args: string[], message: RegExp) => {
    const { code, stderr } = await generate(...args);
    assert.equal(code, 2, stderr);
    assert.match(stderr, message);
  };
  const regular = [{ name: "regular", rps: 10, seconds: 1 }];
  await refused([], /name the load once, as JSON or a file/);
  await refused(["{not json"], /the load is not JSON/);
  await refused([join(OUT, "missing.json")], /cannot read the load at .*missing\.json/);
  await refused([load(regular, { rps: 10 })], /the load: Unrecognized key: "rps"/);
  await refused([load(regular, { target: "nowhere" })], /target: expected host:port/);
  await refused([load(regular, { framework: "go:unregistered" })], /framework: go:unregistered has no client-exception declaration/);
  await refused([load(regular, { values: { ...VALUES, one: 7 } })], /values\.one: Too small: expected number to be >=1000/);
  await refused([load([])], /phases: Too small: expected array to have >=1 items/);
  await refused([load([{ name: "warmup", rps: 10 }])], /phases\.0: a phase needs settle, seconds or both/);
  const unjudged = [{ name: "regular", rps: 10, seconds: 1, abortDropFraction: 0.05 }];
  await refused([load(unjudged)], /phases\.0\.abortDropFraction: there is no settle to judge/);
  await refused([load([...regular, ...regular])], /phases: two phases are named regular/);
  await refused([load(regular, { only: ["nope"] })], /only: nope is neither a test nor a family/);
});
