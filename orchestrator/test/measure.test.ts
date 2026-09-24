// A whole run with a fake host: the reference served over a socket stands in for each framework's
// container, and the real traffic generator measures it. On lambda-emulator a runtime client in
// this process stands in for the function, and asks the generator's Runtime API for its events.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import suite from "@rb/tests";
import exceptions from "../../frameworks/exceptions.ts";
import { isClosed, type ClosedPhase, type Load } from "../../traffic-generator/load.ts";
import type { LoadedFramework, RbJson } from "../manifest.ts";
import { measure, type Driver, type RunFile, type Started } from "../measure.ts";
import { loadSnapshots } from "../snapshots.ts";
import { summarize } from "../summarize.ts";
import type { Transport } from "../validate.ts";
import { corpusReference } from "./reference.ts";
import { runtime } from "./runtime.ts";
import { serve } from "./serve.ts";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const OUT = mkdtempSync(join(tmpdir(), "rb-measure-"));
after(() => rmSync(OUT, { recursive: true, force: true }));

const snapshots = loadSnapshots(ROOT, Object.keys(suite.tests));
type Id = keyof typeof exceptions;

const rb = (framework: string): RbJson => ({
  framework,
  licence: "MIT",
  repo: "https://example.com/repo",
  package: "https://example.com/package",
  lockfile: null,
  hosts: { "container-h1": { dockerfile: "Dockerfile" } },
  upgrade: null,
  mechanisms: {},
});

const framework = (id: Id): LoadedFramework => {
  const [language, name] = id.split(":") as [string, string];
  return {
    language,
    name,
    id,
    dir: `frameworks/${language}/${name}`,
    rb: rb(name),
    declared: { language, name, framework: name, hosts: {}, mechanisms: {} },
  };
};

/** What every framework answers besides the corpus: readiness, and what it says it is. */
const framed =
  (f: LoadedFramework, behaviour: Transport): Transport =>
  async (req) => {
    if (req.target === "/health") return { status: 200, headers: { "content-type": "text/plain" }, body: new TextEncoder().encode("ok") };
    if (req.target === "/__meta") {
      const body = new TextEncoder().encode(JSON.stringify({ framework: f.name, version: "0.0.0" }));
      return { status: 200, headers: { "content-type": "application/json" }, body };
    }
    return behaviour(req);
  };

/**
 * A host whose "container" is the reference, answering as `id` does, or as told, in the host's
 * protocol. Its "function" is the reference behind a runtime client.
 */
function fakeDriver(answer: (id: Id) => Transport | "dead", protocol: "http/1.1" | "h2c" = "http/1.1"): Driver {
  return {
    build: async () => ({ imageId: "sha256:fake", imageBytes: 1 }),
    start: async (f): Promise<Started> => {
      const behaviour = answer(f.id as Id);
      if (behaviour === "dead") {
        return { address: { host: "127.0.0.1", port: 1 }, startMs: 1, alive: () => false, logs: () => "it would not start", stop: () => {} };
      }
      const served = await serve(framed(f, behaviour), protocol);
      let up = true;
      return {
        address: served,
        startMs: 1,
        alive: () => up,
        logs: () => "",
        stop: () => {
          up = false;
          void served.close();
        },
      };
    },
    startFunction: (f, apiPort) => {
      const behaviour = answer(f.id as Id);
      if (behaviour === "dead") return { startMs: 1, alive: () => false, logs: () => "it would not start", stop: () => {} };
      const targets: string[] = [];
      asked.push(targets);
      const answering = framed(f, behaviour);
      const r = runtime(apiPort, (req) => {
        targets.push(req.target);
        return answering(req);
      });
      return { startMs: 1, alive: r.alive, logs: () => "", stop: r.stop };
    },
  };
}

const reference = (id: Id): Transport => corpusReference(snapshots, id, exceptions[id]).transport();

const PHASES: Load["phases"] = [
  { name: "warmup", rps: 200, settle: 1 },
  { name: "regular", rps: 100, settle: 1, seconds: 1, abortDropFraction: 0.05 },
];

const CLOSED_PHASES: ClosedPhase[] = [{ name: "closed", seconds: 1 }];

/** What each function the fake driver started was asked, in the order it was started. */
const asked: string[][] = [];

async function run(
  driver: Driver,
  ids: Id[],
  edit: (f: LoadedFramework) => LoadedFramework = (f) => f,
  host: "container-h1" | "container-h2" | "lambda-emulator" = "container-h1",
): Promise<RunFile> {
  return measure({
    root: ROOT,
    host,
    frameworks: ids.map(framework).map(edit),
    driver,
    phases: PHASES,
    closedPhases: CLOSED_PHASES,
    ladder: "ladder-test",
    bootMs: 5000,
    cooldownMs: 0,
    notRecorded: ["a test"],
    at: undefined,
    machine: { available: false, cpu: "test", cores: 1, platform: "test" },
    budget: { cpus: "2" },
    tools: { node: process.version },
    outDir: OUT,
    workers: 2,
    log: () => {},
  });
}

test("a framework that passes the gate is measured, and one that fails it is not", async () => {
  const wrong = (id: Id): Transport => {
    const inner = reference(id);
    return async (req) => {
      const r = await inner(req);
      return req.target === "/json/medium" ? { ...r, body: new TextEncoder().encode("[]") } : r;
    };
  };
  const result = await run(
    fakeDriver((id) => (id === "node:fastify" ? reference(id) : wrong(id))),
    ["node:fastify", "python:fastapi"],
  );

  assert.deepEqual(JSON.parse(readFileSync(join(OUT, `${result.runId}.json`), "utf8")), result);
  assert.equal(result.recorded, false);
  assert.deepEqual(result.notRecorded, ["a test"]);
  assert.match(result.tests.corpusVersion, /^sha256:[0-9a-f]{64}$/);
  assert.match(result.generator, /^sha256:[0-9a-f]{64}$/);

  const [fastify, fastapi] = result.frameworks;
  assert.equal(fastify!.id, "node:fastify");
  assert.equal(fastify!.ordinal, 1);
  assert.equal(fastify!.gate?.measurable, true);
  assert.ok(fastify!.boot !== undefined && fastify!.boot.readyMs > 0);
  assert.equal(fastify!.error, undefined);
  const load = fastify!.load!;
  assert.ok(!isClosed(load));
  assert.deepEqual(load.load.values, result.values);
  assert.deepEqual(load.load.phases, PHASES);
  assert.deepEqual(load.phases.map((p) => [p.name, p.status]), [["warmup", "done"], ["regular", "done"]]);
  const regular = load.phases[1]!;
  assert.ok(regular.status === "done" && regular.recorded !== undefined && regular.recorded.completed === 100);

  assert.equal(fastapi!.gate?.measurable, false);
  assert.equal(fastapi!.gate?.outcomes["json.medium"]?.status, "failed");
  assert.equal(fastapi!.load, undefined);
  assert.equal(fastapi!.error, "it failed the gate, so it was not measured");
});

test("a test the framework does not support on its host is recorded as such, and neither the gate nor the load sends it", async () => {
  const unsupported = { "json.medium": "the runtime client buffers the answer" };
  const asked: string[] = [];
  const inner = reference("node:fastify");
  // json.medium answered wrong, which would fail the gate if it were sent.
  const counting: Transport = async (req) => {
    asked.push(req.target);
    const r = await inner(req);
    return req.target === "/json/medium" ? { ...r, body: new TextEncoder().encode("[]") } : r;
  };
  const result = await run(fakeDriver(() => counting), ["node:fastify"], (f) => ({
    ...f,
    rb: { ...f.rb, hosts: { "container-h1": { dockerfile: "Dockerfile", unsupported } } },
  }));
  const [fastify] = result.frameworks;
  assert.deepEqual(fastify!.unsupported, unsupported);
  assert.deepEqual(fastify!.gate?.outcomes["json.medium"], { status: "unsupported", reason: unsupported["json.medium"] });
  assert.equal(fastify!.gate?.measurable, true);
  assert.deepEqual(fastify!.load?.load.unsupported, unsupported);
  const regular = fastify!.load!.phases[1]!;
  assert.ok(regular.status === "done" && regular.recorded !== undefined);
  assert.equal(regular.recorded.tests.some((t) => t.id === "json.medium"), false);
  // The gate asks the validating client and the load asks the generator, and neither reached the route.
  assert.equal(asked.includes("/json/medium"), false);
});

test("on container-h2 the boot, the gate, the load and /__meta all go over h2c", async () => {
  const result = await run(fakeDriver(reference, "h2c"), ["node:fastify"], (f) => f, "container-h2");
  const [fastify] = result.frameworks;
  assert.equal(fastify!.error, undefined);
  assert.equal(fastify!.gate?.measurable, true);
  assert.equal(fastify!.meta?.["framework"], "fastify");
  const load = fastify!.load!;
  assert.ok(!isClosed(load));
  assert.deepEqual([load.load.protocol, load.load.connections, load.load.streams], ["h2c", 16, 16]);
  const regular = load.phases[1]!;
  assert.ok(regular.status === "done" && regular.recorded !== undefined && regular.recorded.completed === 100);
  assert.equal(regular.recorded.errors + regular.recorded.mismatch, 0);
});

test("on lambda-emulator the runtime asks the Runtime API for every event: the gate's, the closed loop's and /__meta", async () => {
  asked.length = 0;
  const result = await run(fakeDriver(reference), ["node:fastify"], (f) => f, "lambda-emulator");
  const [fastify] = result.frameworks;
  assert.equal(fastify!.error, undefined);
  assert.equal(fastify!.gate?.measurable, true);
  assert.equal(fastify!.meta?.["framework"], "fastify");
  const load = fastify!.load!;
  assert.ok(isClosed(load));
  assert.deepEqual(load.phases.map((p) => p.name), ["closed"]);
  const recorded = load.phases[0]!.recorded!;
  const wrong = recorded.tests.filter((t) => t.errors + t.mismatch > 0).map((t) => [t.id, t.firstError, t.firstMismatch]);
  assert.deepEqual(wrong, []);
  assert.ok(recorded.invocations > 0 && recorded.tests.every((t) => t.count > 0));
  // The boot's first event is the recording's first invocation, and every second is accounted for.
  assert.ok(recorded.first !== undefined && recorded.first.responseUs > 0);
  assert.equal(fastify!.boot?.probeMs, Math.round(recorded.first.responseUs / 100) / 10);
  const perSecond = recorded.perSecond ?? [];
  assert.equal(perSecond.reduce((n, s) => n + s.invocations, 0), recorded.tests.reduce((n, t) => n + t.count, 0));
  // A second's recording fits in one window, which holds every invocation of its test.
  assert.deepEqual(recorded.tests.filter((t) => t.windows?.length !== 1 || t.windows[0]![0] !== t.count), []);
  const summary = summarize(result).frameworks[0]!;
  const rung = summary.rungs["closed"]!;
  assert.ok("closed" in rung && rung.achievedRps > 0 && rung.first?.id === recorded.first.id);
  assert.ok(Object.values(summary.tests).every((t) => t.rungs["closed"]?.windows?.length === 1));
});

test("on lambda-emulator the gate's boot primes the load, so the measured function answers nothing before its first recorded event", async () => {
  asked.length = 0;
  const result = await run(fakeDriver(reference), ["node:fastify"], (f) => f, "lambda-emulator");
  const load = result.frameworks[0]!.load!;
  assert.ok(isClosed(load));
  const recorded = load.phases[0]!.recorded!;
  assert.equal(asked.length, 2, "one function for the gate and priming, one measured");
  const [gated, measured] = asked as [string[], string[]];
  assert.ok(gated.length > measured.length / 100, "priming went to the gate's function");
  // The measured function answered the recording's events and then /__meta, and nothing else.
  assert.equal(measured.length, recorded.invocations + 1);
  assert.equal(measured.at(-1), "/__meta");
  assert.ok(!measured.slice(0, -1).includes("/health"));
});

test("a function that exits before its runtime asks for an event is reported with its log, and the run goes on", async () => {
  const result = await run(fakeDriver((id) => (id === "dotnet:carter" ? "dead" : reference(id))), ["dotnet:carter", "node:fastify"], (f) => f, "lambda-emulator");
  const [carter, fastify] = result.frameworks;
  assert.match(carter!.error ?? "", /the gate's boot failed: the function exited before its runtime asked for an event\nit would not start/);
  assert.equal(fastify!.error, undefined);
});

test("a framework that never answers /health is reported with its log, and the run goes on", async () => {
  const result = await run(fakeDriver((id) => (id === "dotnet:carter" ? "dead" : reference(id))), ["dotnet:carter", "node:fastify"]);
  const [carter, fastify] = result.frameworks;
  assert.match(carter!.error!, /^the gate's boot failed: the framework exited before it answered \/health\nit would not start$/);
  assert.equal(fastify!.gate?.measurable, true);
  assert.notEqual(fastify!.load, undefined);
});
