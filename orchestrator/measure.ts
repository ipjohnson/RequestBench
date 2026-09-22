// One run: every framework that implements a host, one at a time, gated on the corpus, then
// measured by the traffic generator, and written to one run file.
//
// The gate gets a boot of its own. It asks every question at least once, so on the boot being
// measured it would spend the framework's cold start before the warmup. A framework that fails
// the gate is not measured, and its run entry says why.
//
// How a framework is built and started is the driver's business, so a test can hand in one
// that serves the reference instead of a container.
import { spawn } from "node:child_process";
import { randomBytes, randomInt } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import suite from "@rb/tests";
import type { RunValues } from "@rb/tests/kit";
import { drawRunValues } from "@rb/tests/models/parameters";
import exceptions from "../frameworks/exceptions.ts";
import type { Load, LoadResult } from "../traffic-generator/load.ts";
import { frameworkBundle, testsBundle, treeRollup } from "./bundle.ts";
import { meta, probe, type Address, type Budget } from "./container.ts";
import { corpusVersion, payloadFiles, recordAll } from "./corpus.ts";
import { gate, type Outcome } from "./gate.ts";
import { repoSlug, resolveCommit } from "./git.ts";
import type { HostId } from "./hosts.ts";
import { http1 } from "./live.ts";
import type { MachineState } from "./machine.ts";
import type { LoadedFramework } from "./manifest.ts";

export interface Started {
  readonly address: Address;
  readonly startMs: number;
  alive(): boolean;
  logs(): string;
  stop(): void;
}

export interface Driver {
  build(f: LoadedFramework): Promise<{ readonly imageId: string; readonly imageBytes: number }>;
  start(f: LoadedFramework): Promise<Started> | Started;
}

export interface FrameworkRun {
  readonly id: string;
  /** Where in the run it was measured. A framework late in a long run boots on a machine that has been under load. */
  readonly ordinal: number;
  readonly bundleHash: string;
  readonly codeHash: string;
  readonly image?: { readonly id: string; readonly bytes: number };
  readonly gate?: { readonly measurable: boolean; readonly passed: boolean; readonly outcomes: Readonly<Record<string, Outcome>> };
  /** The measured boot. The gate's boot ran the same image moments before, so the page cache was warm. */
  readonly boot?: { readonly startMs: number; readonly readyMs: number; readonly wallMs: number; readonly probeMs: number; readonly pageCache: "warm" };
  /** What /__meta answered, verbatim. */
  readonly meta?: Readonly<Record<string, unknown>>;
  /** The traffic generator's result, unchanged. */
  readonly load?: LoadResult;
  /** Why this framework has no measurement, with the end of its log where there is one. */
  readonly error?: string;
}

export interface RunFile {
  readonly runId: string;
  readonly host: HostId;
  /** Whether this run enters the published series. The reasons say why not. */
  readonly recorded: boolean;
  readonly notRecorded: readonly string[];
  readonly started: string;
  readonly finished: string;
  readonly commit: string;
  readonly repo: string;
  readonly ladder: string;
  readonly values: RunValues;
  readonly tests: {
    readonly bundleHash: string;
    readonly codeHash: string;
    /** Which questions were asked. Two runs are comparable when this matches. */
    readonly corpusVersion: string;
  };
  /** The traffic generator's own files, so a change in how load is sent shows up by itself. */
  readonly generator: string;
  readonly machine: MachineState;
  readonly budget: Budget & { readonly genCpus?: string };
  readonly tools: { readonly node: string; readonly docker?: string };
  readonly frameworks: readonly FrameworkRun[];
}

export interface MeasureOptions {
  readonly root: string;
  readonly host: HostId;
  readonly frameworks: readonly LoadedFramework[];
  readonly driver: Driver;
  readonly phases: Load["phases"];
  readonly ladder: string;
  readonly only?: readonly string[] | undefined;
  readonly bootMs: number;
  readonly cooldownMs: number;
  /** Empty when the run is recorded; otherwise every reason it is not. */
  readonly notRecorded: readonly string[];
  /** The commit bundles are read at when the run is recorded, so they describe what the images were built from. */
  readonly at: string | undefined;
  readonly machine: MachineState;
  readonly budget: Budget & { readonly genCpus?: string };
  readonly tools: RunFile["tools"];
  /** The run file is written here, named for the run. */
  readonly outDir: string;
  /** Threads for the generator. Its own default when absent. */
  readonly workers?: number | undefined;
  readonly generate?: (load: Load, log: (line: string) => void) => Promise<LoadResult>;
  readonly log?: (line: string) => void;
}

const round = (ms: number) => Math.round(ms * 10) / 10;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The traffic generator as its own process, pinned to RB_GEN_CPUS on Linux, handed the load as a file. */
export function generator(root: string, genCpus?: string): (load: Load, log: (line: string) => void) => Promise<LoadResult> {
  return async (load, log) => {
    const dir = mkdtempSync(join(tmpdir(), "rb-load-"));
    const loadFile = join(dir, "load.json");
    const out = join(dir, "result.json");
    writeFileSync(loadFile, JSON.stringify(load));
    const node = [process.execPath, "--experimental-strip-types", "--disable-warning=ExperimentalWarning", join(root, "traffic-generator", "cli.ts"), loadFile, "--out", out];
    const pinned = genCpus && process.platform === "linux" ? ["taskset", "-c", genCpus, ...node] : node;
    try {
      const code = await new Promise<number | null>((resolve, reject) => {
        const child = spawn(pinned[0]!, pinned.slice(1), { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
        let tail = "";
        const lines = (chunk: Buffer) => {
          tail += chunk.toString();
          const parts = tail.split("\n");
          tail = parts.pop() ?? "";
          // Its result goes to a temporary file this reads and deletes, so that path is not worth showing.
          for (const line of parts) if (!line.startsWith("result -> ")) log(line);
        };
        child.stdout.on("data", lines);
        child.stderr.on("data", lines);
        child.on("error", reject);
        child.on("close", (c) => {
          if (tail !== "") log(tail);
          resolve(c);
        });
      });
      if (code !== 0) throw new Error(`the traffic generator exited with ${code}`);
      return JSON.parse(readFileSync(out, "utf8")) as LoadResult;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
}

export async function measure(o: MeasureOptions): Promise<RunFile> {
  const log = o.log ?? ((line: string) => console.log(line));
  const started = new Date();
  // Drawn here, before anything boots, from a source no framework can read. Every client in
  // the run sends the same ones.
  const values = drawRunValues(() => randomInt(2 ** 47) / 2 ** 47);
  const recordings = await recordAll(suite);
  const tests = testsBundle(o.root, o.at);
  const commit = resolveCommit(o.root);
  const runId = `${started.toISOString().slice(0, 16).replace(":", "")}Z.${o.host}.${randomBytes(3).toString("hex")}`;
  const generate = o.generate ?? generator(o.root, o.budget.genCpus);

  const entries: FrameworkRun[] = [];
  const images = new Map<string, { id: string; bytes: number } | Error>();
  // Every image first, so a broken build is known before anything is measured.
  for (const f of o.frameworks) {
    log(`build ${f.id}`);
    try {
      const built = await o.driver.build(f);
      images.set(f.id, { id: built.imageId, bytes: built.imageBytes });
    } catch (error) {
      images.set(f.id, error as Error);
    }
  }

  for (const [i, f] of o.frameworks.entries()) {
    const bundle = frameworkBundle(o.root, f, o.at);
    const base = { id: f.id, ordinal: i + 1, bundleHash: bundle.bundleHash, codeHash: bundle.codeHash };
    const image = images.get(f.id)!;
    log(`\n=== ${f.id} (${i + 1} of ${o.frameworks.length})`);
    if (image instanceof Error) {
      entries.push({ ...base, error: `the build failed: ${image.message}` });
      log(`  build failed: ${image.message}`);
      continue;
    }
    const withImage = { ...base, image };

    // The gate's boot.
    let gated;
    const first = await o.driver.start(f);
    try {
      await probe(first.address, o.bootMs, first.alive);
      const live = http1(first.address);
      try {
        gated = await gate({
          suite,
          transport: live.transport,
          exceptions: exceptions[f.id as keyof typeof exceptions],
          declared: f.declared,
          skips: f.rb.skips,
          run: values,
          alive: async () => first.alive(),
        });
      } finally {
        live.close();
      }
    } catch (error) {
      entries.push({ ...withImage, error: `the gate's boot failed: ${(error as Error).message}\n${first.logs()}` });
      log(`  boot failed: ${(error as Error).message}`);
      continue;
    } finally {
      first.stop();
      await pause(o.cooldownMs);
    }
    const counts = Object.values(gated.outcomes).reduce<Record<string, number>>((c, x) => ((c[x.status] = (c[x.status] ?? 0) + 1), c), {});
    log(`  gate: ${Object.entries(counts).map(([k, n]) => `${n} ${k}`).join(", ")}`);
    const gateRecord = { measurable: gated.measurable, passed: gated.passed, outcomes: gated.outcomes };
    if (!gated.measurable) {
      entries.push({ ...withImage, gate: gateRecord, error: "it failed the gate, so it was not measured" });
      continue;
    }

    // The measured boot.
    const second = await o.driver.start(f);
    try {
      const ready = await probe(second.address, o.bootMs, second.alive);
      const boot = {
        startMs: round(second.startMs),
        readyMs: round(ready.readyMs),
        wallMs: round(second.startMs + ready.readyMs),
        probeMs: round(ready.probeMs),
        pageCache: "warm" as const,
      };
      log(`  boot: start ${boot.startMs} + ready ${boot.readyMs} = ${boot.wallMs} ms; the first /health took ${boot.probeMs} ms`);
      const load: Load = {
        target: `${second.address.host}:${second.address.port}`,
        framework: f.id,
        values,
        ...(o.workers === undefined ? {} : { workers: o.workers }),
        ...(o.only === undefined ? {} : { only: [...o.only] }),
        phases: [...o.phases],
      };
      const result = await generate(load, (line) => log(`  ${line}`));
      entries.push({ ...withImage, gate: gateRecord, boot, meta: await meta(second.address), load: result });
    } catch (error) {
      entries.push({ ...withImage, gate: gateRecord, error: `the measured boot failed: ${(error as Error).message}\n${second.logs()}` });
      log(`  measurement failed: ${(error as Error).message}`);
    } finally {
      second.stop();
      await pause(o.cooldownMs);
    }
  }

  const run: RunFile = {
    runId,
    host: o.host,
    recorded: o.notRecorded.length === 0,
    notRecorded: o.notRecorded,
    started: started.toISOString(),
    finished: new Date().toISOString(),
    commit,
    repo: repoSlug(o.root),
    ladder: o.ladder,
    values,
    tests: {
      bundleHash: tests.bundleHash,
      codeHash: tests.codeHash,
      corpusVersion: corpusVersion(suite, recordings, payloadFiles(o.root)),
    },
    generator: treeRollup(o.root, "traffic-generator/", o.at),
    machine: o.machine,
    budget: o.budget,
    tools: o.tools,
    frameworks: entries,
  };
  const out = join(o.outDir, `${runId}.json`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(run, null, 2)}\n`);
  log(`\nrun ${runId} -> ${out}${run.recorded ? "" : ` (not recorded: ${run.notRecorded.join("; ")})`}`);
  return run;
}
