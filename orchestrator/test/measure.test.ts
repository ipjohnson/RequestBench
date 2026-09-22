// A whole run with a fake host: the reference served over a socket stands in for each framework's
// container, and the real traffic generator measures it.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import suite from "@rb/tests";
import exceptions from "../../frameworks/exceptions.ts";
import type { Load } from "../../traffic-generator/load.ts";
import type { LoadedFramework, RbJson } from "../manifest.ts";
import { measure, type Driver, type RunFile, type Started } from "../measure.ts";
import { loadSnapshots } from "../snapshots.ts";
import type { Transport } from "../validate.ts";
import { corpusReference } from "./reference.ts";
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

/** A host whose "container" is the reference, answering as `id` does, or as told. */
function fakeDriver(answer: (id: Id) => Transport | "dead"): Driver {
  return {
    build: async () => ({ imageId: "sha256:fake", imageBytes: 1 }),
    start: async (f): Promise<Started> => {
      const behaviour = answer(f.id as Id);
      if (behaviour === "dead") {
        return { address: { host: "127.0.0.1", port: 1 }, startMs: 1, alive: () => false, logs: () => "it would not start", stop: () => {} };
      }
      // What every framework answers besides the corpus: readiness, and what it says it is.
      const served = await serve(async (req) => {
        if (req.target === "/health") return { status: 200, headers: { "content-type": "text/plain" }, body: new TextEncoder().encode("ok") };
        if (req.target === "/__meta") {
          const body = new TextEncoder().encode(JSON.stringify({ framework: f.name, version: "0.0.0" }));
          return { status: 200, headers: { "content-type": "application/json" }, body };
        }
        return behaviour(req);
      });
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
  };
}

const reference = (id: Id): Transport => corpusReference(snapshots, id, exceptions[id]).transport();

const PHASES: Load["phases"] = [
  { name: "warmup", rps: 200, settle: 1 },
  { name: "regular", rps: 100, settle: 1, seconds: 1, abortDropFraction: 0.05 },
];

async function run(driver: Driver, ids: Id[]): Promise<RunFile> {
  return measure({
    root: ROOT,
    host: "container-h1",
    frameworks: ids.map(framework),
    driver,
    phases: PHASES,
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

test("a framework that never answers /health is reported with its log, and the run goes on", async () => {
  const result = await run(fakeDriver((id) => (id === "dotnet:carter" ? "dead" : reference(id))), ["dotnet:carter", "node:fastify"]);
  const [carter, fastify] = result.frameworks;
  assert.match(carter!.error!, /^the gate's boot failed: the framework exited before it answered \/health\nit would not start$/);
  assert.equal(fastify!.gate?.measurable, true);
  assert.notEqual(fastify!.load, undefined);
});
