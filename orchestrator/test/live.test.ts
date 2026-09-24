// The gate over a real socket, with the reference standing in for a framework that is running.
import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import suite from "@rb/tests";
import { validationTest } from "@rb/tests/kit";
import type { Suite } from "@rb/tests/kit";
import exceptions from "../../frameworks/exceptions.ts";
import { exemplarFile, exemplarOf, FIXED_VALUES, gate } from "../gate.ts";
import { http1, type Exchange } from "../live.ts";
import { loadSnapshots } from "../snapshots.ts";
import type { Transport } from "../validate.ts";
import { corpusReference } from "./reference.ts";
import { serve } from "./serve.ts";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const snapshots = loadSnapshots(ROOT, Object.keys(suite.tests));
type Id = keyof typeof exceptions;

/** One reference process for the whole corpus, as a framework is one process for the whole gate. */
const referenceFor = (framework: Id): Transport => corpusReference(snapshots, framework, exceptions[framework]).transport();

async function gateOver(framework: Id, transport: Transport, over: { suite?: Suite; skips?: Record<string, string> } = {}) {
  const served = await serve(transport);
  const sink: { current: Exchange[] } = { current: [] };
  const live = http1(served, (e) => sink.current.push(e));
  let up = true;
  try {
    const result = await gate({
      suite: over.suite ?? suite,
      transport: live.transport,
      exceptions: exceptions[framework],
      skips: over.skips,
      run: FIXED_VALUES,
      alive: async () => up,
      exchanges: sink,
    });
    return result;
  } finally {
    up = false;
    await live.close();
    await served.close();
  }
}

for (const framework of Object.keys(exceptions) as Id[]) {
  test(`the reference passes the whole corpus over a socket, as ${framework}`, async () => {
    const result = await gateOver(framework, referenceFor(framework));
    const failed = Object.entries(result.outcomes).filter(([, o]) => o.status !== "passed");
    assert.deepEqual(failed, []);
    assert.equal(result.measurable, true);
    assert.equal(result.passed, true);
  });
}

test("a wrong answer fails its own test and no other", async () => {
  const reference = referenceFor("node:fastify");
  const wrong: Transport = async (req) => {
    const r = await reference(req);
    return req.target === "/json/medium" ? { ...r, body: new TextEncoder().encode("[]") } : r;
  };
  const result = await gateOver("node:fastify", wrong);
  const failed = Object.entries(result.outcomes).filter(([, o]) => o.status === "failed").map(([id]) => id);
  assert.deepEqual(failed, ["json.medium"]);
  assert.equal(result.measurable, false);
});

test("once the framework stops answering, the rest is unrun rather than failed", async () => {
  const reference = referenceFor("node:fastify");
  const served = await serve(reference);
  let stopped = false;
  const dying: Transport = async (req) => {
    if (req.target === "/etag/large" || stopped) {
      stopped = true;
      throw new Error("connect ECONNREFUSED");
    }
    return reference(req);
  };
  const result = await gate({
    suite,
    transport: dying,
    exceptions: exceptions["node:fastify"],
    run: FIXED_VALUES,
    alive: async () => !stopped,
  });
  await served.close();
  const statuses = Object.entries(result.outcomes);
  const firstBad = statuses.findIndex(([, o]) => o.status !== "passed");
  assert.equal(statuses[firstBad]![0], "etag.large");
  assert.equal(statuses[firstBad]![1].status, "failed");
  assert.ok(statuses.slice(firstBad + 1).every(([, o]) => o.status === "unrun"));
  assert.equal(result.measurable, false);
});

test("a skip is reported with its reason, and a test scoped out is not asked", async () => {
  const outside = validationTest({
    id: { family: "cors", name: "only_elsewhere" },
    about: "asked only of frameworks with no mechanisms at all",
    request: (c) => c.get("/nowhere").ok(),
    scope: () => false,
  });
  const scoped: Suite = { ...suite, tests: { ...suite.tests, "cors.only_elsewhere": outside } };
  const reason = "the CORS feature applies to the whole application";
  const served = await serve(referenceFor("node:fastify"));
  const live = http1(served);
  const result = await gate({
    suite: scoped,
    transport: live.transport,
    exceptions: exceptions["node:fastify"],
    declared: { language: "node", name: "fastify", framework: "Fastify", hosts: {}, mechanisms: {} },
    skips: { "cors.scoped": reason },
    run: FIXED_VALUES,
    alive: async () => true,
  });
  await live.close();
  await served.close();
  assert.deepEqual(result.outcomes["cors.scoped"], { status: "skipped", reason });
  assert.deepEqual(result.outcomes["cors.only_elsewhere"], { status: "notAsked" });
  assert.equal(result.passed, true);
});

test("an unsupported test is reported with its reason and never sent, and it fails nothing", async () => {
  const reference = referenceFor("node:fastify");
  const asked: string[] = [];
  const counting: Transport = (req) => {
    asked.push(req.target);
    return reference(req);
  };
  const why = "the runtime client buffers the answer";
  const result = await gate({
    suite,
    transport: counting,
    exceptions: exceptions["node:fastify"],
    unsupported: { "sse.medium": why, "cors.scoped": why },
    run: FIXED_VALUES,
    alive: async () => true,
  });
  assert.deepEqual(result.outcomes["sse.medium"], { status: "unsupported", reason: why });
  assert.deepEqual(result.outcomes["cors.scoped"], { status: "unsupported", reason: why });
  assert.equal(asked.includes("/sse/medium"), false);
  assert.equal(result.measurable, true);
  assert.equal(result.passed, true);
});

test("an exemplar is the test's own exchange, with the volatile headers masked", async () => {
  const result = await gateOver("node:fastify", referenceFor("node:fastify"));
  const file = exemplarFile("node:fastify", "container-h1", result.exchanges);
  assert.equal(Object.keys(file.tests).length, Object.keys(suite.tests).length);
  const small = file.tests["json.small"]!;
  assert.equal(small.request.method, "GET");
  assert.equal(small.request.target, "/json/small");
  assert.equal(small.response.status, 200);
  assert.equal(small.response.framing, "content-length");
  assert.ok(small.response.headers.some(([k, v]) => k === "date" && v === "<varies>"));
  assert.equal(JSON.parse(small.response.body).count, 1);
  const gzip = file.tests["compressed.gzip_large"]!;
  assert.ok(gzip.response.bodyBytes < Buffer.byteLength(gzip.response.body) || gzip.response.truncated);
  const match = file.tests["etag.match_large"]!;
  assert.equal(match.response.status, 304);
  assert.ok(match.request.headers.some(([k]) => k === "if-none-match"));
  assert.match(result.exchanges.get("json.small")!.hostHeader, /^127\.0\.0\.1:\d+$/);
});

test("an exemplar shows the Host the request carried as <request host> wherever the answer repeats it", () => {
  const body = Buffer.from('{"message":"Cannot find any route matching [GET] http://127.0.0.1:63509/items"}');
  const exchange: Exchange = {
    request: { method: "POST", target: "/items", headers: {}, body: "{}" },
    hostHeader: "127.0.0.1:63509",
    response: {
      status: 201,
      statusMessage: "Created",
      httpVersion: "1.1",
      rawHeaders: [["Location", "http://127.0.0.1:63509/items/1426"], ["Content-Length", String(body.length)]],
      body,
    },
  };

  const shown = exemplarOf(exchange).response;

  assert.deepEqual(shown.headers, [["location", "http://<request host>/items/1426"], ["content-length", String(body.length)]]);
  assert.equal(shown.body, '{"message":"Cannot find any route matching [GET] http://<request host>/items"}');
  assert.equal(shown.bodyBytes, body.length);
});
