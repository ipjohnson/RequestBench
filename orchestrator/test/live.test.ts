// The gate over a real socket, with the reference standing in for a framework that is running.
import assert from "node:assert/strict";
import { test } from "node:test";

import suite from "@rb/tests";
import { validationTest } from "@rb/tests/kit";
import type { Suite } from "@rb/tests/kit";
import type { Protocol } from "../../traffic-generator/pipe.ts";
import { exemplarFile, exemplarOf, FIXED_VALUES, gate } from "../gate.ts";
import { live, type Exchange } from "../live.ts";
import type { Transport } from "../validate.ts";
import { CONTRACTS, FIRST_ERROR } from "./contracts.ts";
import { corpusReference, type Contract } from "./reference.ts";
import { serve } from "./serve.ts";

/** One reference process for the whole corpus, as a framework is one process for the whole gate. */
const referenceFor = (contract: Contract): Transport => corpusReference(contract).transport();

async function gateOver(
  contract: Contract,
  transport: Transport,
  over: { suite?: Suite; skips?: Record<string, string> } = {},
  protocol: Protocol = "http/1.1",
) {
  const served = await serve(transport, protocol);
  const sink: { current: Exchange[] } = { current: [] };
  const reached = live(served, protocol, (e) => sink.current.push(e));
  let up = true;
  try {
    const result = await gate({
      suite: over.suite ?? suite,
      transport: reached.transport,
      exceptions: contract.declared,
      skips: over.skips,
      run: FIXED_VALUES,
      alive: async () => up,
      exchanges: sink,
    });
    return result;
  } finally {
    up = false;
    await reached.close();
    await served.close();
  }
}

for (const contract of CONTRACTS) {
  test(`the reference passes the whole corpus over a socket, as ${contract.id}`, async () => {
    const result = await gateOver(contract, referenceFor(contract));
    const failed = Object.entries(result.outcomes).filter(([, o]) => o.status !== "passed");
    assert.deepEqual(failed, []);
    assert.equal(result.measurable, true);
    assert.equal(result.passed, true);
  });
}

test("the reference passes the whole corpus over h2c, and its exemplars are HTTP/2's", async () => {
  const result = await gateOver(FIRST_ERROR, referenceFor(FIRST_ERROR), {}, "h2c");
  const failed = Object.entries(result.outcomes).filter(([, o]) => o.status !== "passed");
  assert.deepEqual(failed, []);
  const json = exemplarOf(result.exchanges.get("json.small")!);
  assert.equal(json.response.framing, "frames");
  assert.ok(json.response.headers.every(([name]) => name === name.toLowerCase()));
  const head = exemplarOf(result.exchanges.get("items.head")!);
  assert.equal(head.response.framing, "none");
});

test("a wrong answer fails its own test and no other", async () => {
  const reference = referenceFor(FIRST_ERROR);
  const wrong: Transport = async (req) => {
    const r = await reference(req);
    return req.target === "/json/medium" ? { ...r, body: new TextEncoder().encode("[]") } : r;
  };
  const result = await gateOver(FIRST_ERROR, wrong);
  const failed = Object.entries(result.outcomes).filter(([, o]) => o.status === "failed").map(([id]) => id);
  assert.deepEqual(failed, ["json.medium"]);
  assert.equal(result.measurable, false);
});

test("once the framework stops answering, the rest is unrun rather than failed", async () => {
  const reference = referenceFor(FIRST_ERROR);
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
    exceptions: FIRST_ERROR.declared,
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
  const served = await serve(referenceFor(FIRST_ERROR));
  const transport = live(served, "http/1.1");
  const result = await gate({
    suite: scoped,
    transport: transport.transport,
    exceptions: FIRST_ERROR.declared,
    declared: { language: "reference", name: "first-error", framework: "First error", hosts: {}, mechanisms: {} },
    skips: { "cors.scoped": reason },
    run: FIXED_VALUES,
    alive: async () => true,
  });
  await transport.close();
  await served.close();
  assert.deepEqual(result.outcomes["cors.scoped"], { status: "skipped", reason });
  assert.deepEqual(result.outcomes["cors.only_elsewhere"], { status: "notAsked" });
  assert.equal(result.passed, true);
});

test("an unsupported test is reported with its reason and never sent, and it fails nothing", async () => {
  const reference = referenceFor(FIRST_ERROR);
  const asked: string[] = [];
  const counting: Transport = (req) => {
    asked.push(req.target);
    return reference(req);
  };
  const why = "the runtime client buffers the answer";
  const result = await gate({
    suite,
    transport: counting,
    exceptions: FIRST_ERROR.declared,
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
  const result = await gateOver(FIRST_ERROR, referenceFor(FIRST_ERROR));
  const file = exemplarFile(FIRST_ERROR.id, "container-h1", result.exchanges);
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
