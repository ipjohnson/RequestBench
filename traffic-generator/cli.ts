// The traffic generator. It offers the corpus's performance tests to one framework in phases,
// each at a fixed rate, picks a test uniformly for each instance, and records each test's
// latency from the moment its instance was scheduled.
//
//   node traffic-generator/cli.ts load.json --out result.json
//   node traffic-generator/cli.ts '{"target":"127.0.0.1:8080","framework":"node:fastify",
//     "phases":[{"name":"warmup","rps":1000,"settle":30},
//               {"name":"regular","rps":500,"settle":15,"seconds":60,"abortDropFraction":0.05}]}'
//
// The load is JSON, given inline when the argument starts with "{" and read from that file
// otherwise. load.ts declares it and the result. The phases run in order in one process, on the
// same threads and connections. A settle that dropped more than its phase's abortDropFraction
// ends the load there, and the phases after it are not run. A framework dropping that much in
// the settle goes on dropping at that rate.
//
// The full result, histograms included, goes to --out after every phase.
import { randomInt } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import http from "node:http";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { Worker } from "node:worker_threads";
import suite from "@rb/tests";
import { idOf } from "@rb/tests/kit";
import type { PerformanceTest } from "@rb/tests/kit";
import { drawFrom, drawRunValues } from "@rb/tests/models/parameters";
import exceptions, { type FrameworkId } from "../frameworks/exceptions.ts";
import { MeasuredClient, NOTHING_SENT, Once, describe, xorshift, type Shared, type Statuses } from "./client.ts";
import { BUCKETS, addInto, countOf, percentile } from "./histogram.ts";
import {
  addressOf,
  loadSchema,
  type LoadResult,
  type Percentiles,
  type Phase,
  type PhaseResult,
  type RecordedSummary,
  type ResolvedLoad,
  type SettleSummary,
} from "./load.ts";
import { mergeTally, newTally, type Tally } from "./tally.ts";
import type { FromWorker, Job, Report, Schedule, ToWorker } from "./worker.ts";

const USAGE = "usage: node traffic-generator/cli.ts <load, as JSON or a file> [--out <file>]";

class UsageError extends Error {}
class PrimingError extends Error {}

interface Options {
  readonly load: ResolvedLoad;
  readonly host: string;
  readonly port: number;
  readonly statuses: Statuses;
  readonly tests: readonly PerformanceTest[];
  readonly out: string | undefined;
}

function options(args: string[]): Options {
  let parsed;
  try {
    parsed = parseArgs({ args, options: { out: { type: "string" } }, allowPositionals: true });
  } catch (error) {
    throw new UsageError((error as Error).message);
  }
  const { values: v, positionals } = parsed;
  if (positionals.length !== 1) throw new UsageError("name the load once, as JSON or a file");
  const load = loadOf(positionals[0]!);
  const { host, port } = addressOf(load.target)!;
  return { load, host, port, statuses: declared(load.framework), tests: select(load.only), out: v.out };
}

/** The load the argument holds or names, with every default and the run's values filled in. */
function loadOf(arg: string): ResolvedLoad {
  let text = arg;
  if (!arg.trimStart().startsWith("{")) {
    try {
      text = readFileSync(arg, "utf8");
    } catch (error) {
      throw new UsageError(`cannot read the load at ${arg}: ${(error as Error).message}`);
    }
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new UsageError(`the load is not JSON: ${(error as Error).message}`);
  }
  const parsed = loadSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "the load"}: ${i.message}`);
    throw new UsageError(issues.join("; "));
  }
  // Drawn here, a run's values have to come from a source no framework can read.
  const values = parsed.data.values ?? drawRunValues(() => randomInt(2 ** 47) / 2 ** 47);
  return { ...parsed.data, values };
}

/**
 * The statuses this framework declared. rejected(), notFound(), wrongMethod() and unparseable()
 * compare against them, so a load that does not know which framework it is measuring cannot
 * tell a right answer from a wrong one.
 */
function declared(id: string): Statuses {
  if (!Object.hasOwn(exceptions, id)) {
    const known = Object.keys(exceptions).join(", ");
    throw new UsageError(`framework: ${id} has no client-exception declaration, only ${known} do`);
  }
  const { rejected, malformed, notFound, wrongMethod } = exceptions[id as FrameworkId];
  return { rejected, malformed, notFound, wrongMethod };
}

/** The performance tests to offer, by id. `only` names a test by its id, or a whole family by its name. */
function select(only: readonly string[] | undefined): PerformanceTest[] {
  const measured = Object.values(suite.tests)
    .filter((test): test is PerformanceTest => test.kind === "performance")
    .sort((a, b) => (idOf(a.id) < idOf(b.id) ? -1 : 1));
  if (only === undefined) return measured;

  const wanted = new Set<string>();
  for (const name of only) {
    if (Object.hasOwn(suite.tests, name)) {
      if (suite.tests[name]!.kind !== "performance") {
        throw new UsageError(`only: ${name} is a validation test, which is never timed`);
      }
      wanted.add(name);
    } else if (Object.hasOwn(suite.families, name)) {
      for (const test of measured) if (test.id.family === name) wanted.add(idOf(test.id));
    } else {
      throw new UsageError(`only: ${name} is neither a test nor a family`);
    }
  }
  const chosen = measured.filter((test) => wanted.has(idOf(test.id)));
  if (chosen.length === 0) throw new UsageError(`only: ${only.join(", ")} names no performance test`);
  return chosen;
}

/** Seeds for the worker threads, and one past them for this thread. */
const seedOf = (i: number): number => Math.imul(0x9e3779b9, i + 1) >>> 0;

type Base = Omit<Shared, "agent" | "once">;

/**
 * Every test once, in turn on one connection, before anything is timed. This makes each once()
 * value, so the load never has to, and it refuses a test that cannot be sent at all before a
 * phase is spent finding that out in every instance.
 */
async function prime(tests: readonly PerformanceTest[], base: Base): Promise<[string, unknown][]> {
  const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });
  const once = new Once([]);
  try {
    for (const test of tests) {
      const id = idOf(test.id);
      const client = new MeasuredClient({ ...base, agent, once });
      try {
        await test.request(client);
      } catch (error) {
        throw new PrimingError(`priming ${id}: ${describe(error)}`);
      }
      if (client.sent === 0) throw new PrimingError(`priming ${id}: ${NOTHING_SENT}`);
      // A wrong status is the framework's answer, not a test that cannot be sent, so the load
      // goes on and counts it in every instance.
      if (client.mismatch !== undefined) console.log(`  ${id}: ${client.mismatch}`);
    }
    return await once.values();
  } finally {
    agent.destroy();
  }
}

function next<K extends FromWorker["kind"]>(worker: Worker, kind: K): Promise<Extract<FromWorker, { kind: K }>> {
  return new Promise((resolve, reject) => {
    const onMessage = (message: FromWorker) => {
      if (message.kind !== kind) return;
      off();
      resolve(message as Extract<FromWorker, { kind: K }>);
    };
    const onError = (error: Error) => {
      off();
      reject(error);
    };
    const onExit = (code: number) => {
      off();
      reject(new Error(`a worker thread exited with code ${code} before it was ${kind}`));
    };
    const off = () => {
      worker.off("message", onMessage);
      worker.off("error", onError);
      worker.off("exit", onExit);
    };
    worker.on("message", onMessage);
    worker.on("error", onError);
    worker.on("exit", onExit);
  });
}

/** The threads that time every phase, started once so each keeps its connections from one phase to the next. */
async function spawn(o: Options, once: [string, unknown][]): Promise<Worker[]> {
  const tests = o.tests.map((test) => idOf(test.id));
  const { workers, maxInflight, values } = o.load;
  const threads = Array.from({ length: workers }, (_, index) => {
    const job: Job = {
      host: o.host,
      port: o.port,
      tests,
      index,
      workers,
      inflight: Math.ceil(maxInflight / workers),
      seed: seedOf(index),
      statuses: o.statuses,
      run: values,
      once,
    };
    return new Worker(new URL("./worker.ts", import.meta.url), { workerData: job });
  });
  try {
    await Promise.all(threads.map((thread) => next(thread, "ready")));
  } catch (error) {
    await Promise.all(threads.map((thread) => thread.terminate()));
    throw error;
  }
  return threads;
}

/** One phase on every thread, from a start they share until the last of them has drained. */
async function offer(
  threads: readonly Worker[],
  schedule: Schedule,
  limit: number | undefined,
): Promise<{ start: bigint; aborted: boolean; reports: Report[] }> {
  const done = Promise.all(threads.map((thread) => next(thread, "done")));
  // Awaited once the settle is judged. Until then this keeps a thread that fails from being
  // reported as an unhandled rejection instead of as its own error.
  done.catch(() => {});
  // Judged on the drops of every thread together, so no thread goes on while another stops.
  const judging =
    limit === undefined || schedule.settle === 0
      ? undefined
      : { limit, settled: Promise.all(threads.map((thread) => next(thread, "settled"))) };
  // One start for every thread, far enough ahead that it reaches each of them before it
  // passes, so an instance is due at the same moment whichever thread holds it.
  const start = process.hrtime.bigint() + 50_000_000n;
  for (const thread of threads) thread.postMessage({ kind: "phase", schedule, start } satisfies ToWorker);
  let aborted = false;
  if (judging !== undefined) {
    const dropped = (await judging.settled).reduce((sum, message) => sum + message.dropped, 0);
    aborted = dropped / schedule.settle > judging.limit;
    if (aborted) for (const thread of threads) thread.postMessage({ kind: "stop" } satisfies ToWorker);
  }
  return { start, aborted, reports: (await done).map((message) => message.report) };
}

const percentiles = (hist: Uint32Array): Percentiles => ({
  p50Us: percentile(hist, 50),
  p90Us: percentile(hist, 90),
  p99Us: percentile(hist, 99),
  p999Us: percentile(hist, 99.9),
});

const base64 = (hist: Uint32Array): string =>
  Buffer.from(hist.buffer, hist.byteOffset, hist.byteLength).toString("base64");

/** The settle's instances, summed over every test. */
function settleSummary(seconds: number, scheduled: number, reports: readonly Report[]): SettleSummary {
  const t = newTally();
  for (const report of reports) mergeTally(t, report.settle);
  const completed = t.count + t.unrecorded;
  return {
    seconds,
    scheduled,
    completed,
    achievedRps: Math.round(completed / seconds),
    dropped: t.dropped,
    dropFraction: scheduled === 0 ? 0 : t.dropped / scheduled,
    errors: t.errors,
    mismatch: t.mismatch,
    p50Us: percentile(t.hist, 50),
    p99Us: percentile(t.hist, 99),
    ...(t.firstMismatch === undefined ? {} : { firstMismatch: t.firstMismatch }),
    ...(t.firstError === undefined ? {} : { firstError: t.firstError }),
  };
}

/** The recorded instances. `from` is the moment the first of them was due. */
function recordedSummary(
  tests: readonly PerformanceTest[],
  seconds: number,
  scheduled: number,
  from: bigint,
  reports: readonly Report[],
): RecordedSummary {
  const tallies = tests.map(newTally);
  let last = from;
  for (const report of reports) {
    report.tallies.forEach((tally, i) => mergeTally(tallies[i]!, tally));
    if (report.last > last) last = report.last;
  }
  const overall = new Uint32Array(BUCKETS);
  for (const tally of tallies) addInto(overall, tally.hist);
  const sum = (field: (tally: Tally) => number) => tallies.reduce((s, tally) => s + field(tally), 0);
  const unrecorded = sum((t) => t.unrecorded);
  const completed = countOf(overall) + unrecorded;
  const elapsed = last > from ? Number(last - from) / 1e9 : seconds;

  return {
    seconds,
    elapsedSeconds: Number(elapsed.toFixed(2)),
    achievedRps: Math.round(completed / elapsed),
    scheduled,
    completed,
    dropped: sum((t) => t.dropped),
    errors: sum((t) => t.errors),
    mismatch: sum((t) => t.mismatch),
    unrecorded,
    overall: { count: countOf(overall), ...percentiles(overall) },
    tests: tests.map((test, i) => {
      const t = tallies[i]!;
      return {
        id: idOf(test.id),
        family: test.id.family,
        count: t.count,
        errors: t.errors,
        mismatch: t.mismatch,
        dropped: t.dropped,
        unrecorded: t.unrecorded,
        ...percentiles(t.hist),
        ...(t.firstMismatch === undefined ? {} : { firstMismatch: t.firstMismatch }),
        ...(t.firstError === undefined ? {} : { firstError: t.firstError }),
        histB64: base64(t.hist),
      };
    }),
  };
}

async function runPhase(o: Options, threads: readonly Worker[], phase: Phase): Promise<PhaseResult> {
  const schedule: Schedule = {
    rps: phase.rps,
    settle: Math.round(phase.rps * (phase.settle ?? 0)),
    total: Math.round(phase.rps * (phase.seconds ?? 0)),
  };
  const parts = [
    ...(phase.settle === undefined ? [] : [`${phase.settle}s to settle`]),
    ...(phase.seconds === undefined ? [] : [`${schedule.total} instances recorded over ${phase.seconds}s`]),
  ];
  console.log(`${phase.name}: offering ${phase.rps} rps over ${threads.length} threads: ${parts.join(", then ")}`);

  const { start, aborted, reports } = await offer(threads, schedule, phase.abortDropFraction);
  // The recorded instances carry on the settle's schedule, so the first of them is due where it ends.
  const from = start + BigInt(Math.round((schedule.settle * 1e9) / phase.rps));
  const settle = phase.settle === undefined ? {} : { settle: settleSummary(phase.settle, schedule.settle, reports) };
  const recorded =
    phase.seconds === undefined || aborted
      ? {}
      : { recorded: recordedSummary(o.tests, phase.seconds, schedule.total, from, reports) };
  const unfinished = reports.reduce((sum, report) => sum + report.unfinished, 0);
  return { name: phase.name, rps: phase.rps, status: aborted ? "aborted" : "done", ...settle, ...recorded, unfinished };
}

function print(phase: Phase, result: PhaseResult): void {
  if (result.status === "notRun") {
    console.log(`${result.name}: not run`);
    return;
  }
  const { settle, recorded } = result;
  if (settle !== undefined) {
    console.log(
      `  settle: ${settle.completed} of ${settle.scheduled} completed over ${settle.seconds}s, ` +
        `${settle.dropped} dropped (${(settle.dropFraction * 100).toFixed(1)}%), p99 ${settle.p99Us}us`,
    );
    if (result.status === "aborted") {
      console.log(`  more than the ${phase.abortDropFraction} allowed, so the load ends here`);
      if (settle.firstMismatch !== undefined) console.log(`  ${settle.firstMismatch}`);
      if (settle.firstError !== undefined) console.log(`  ${settle.firstError}`);
    }
  }
  if (recorded === undefined) {
    if (result.unfinished > 0) console.log(`  ${result.unfinished} still in flight when the drain gave up`);
    return;
  }

  const width = Math.max("overall".length, ...recorded.tests.map((t) => t.id.length));
  const row = (name: string, ...cells: (string | number)[]) =>
    `  ${name.padEnd(width)}${cells.map((cell) => String(cell).padStart(10)).join("")}`;
  console.log(row("test", "count", "p50Us", "p99Us", "mismatch", "errors", "dropped"));
  for (const t of recorded.tests) console.log(row(t.id, t.count, t.p50Us, t.p99Us, t.mismatch, t.errors, t.dropped));
  const all = recorded.overall;
  console.log(row("overall", all.count, all.p50Us, all.p99Us, recorded.mismatch, recorded.errors, recorded.dropped));
  console.log(
    `\n${recorded.achievedRps} rps achieved over ${recorded.elapsedSeconds}s: ${recorded.completed} of ` +
      `${recorded.scheduled} completed, ${recorded.dropped} dropped, ${recorded.errors} errors, ` +
      `${result.unfinished} unfinished`,
  );
  for (const t of recorded.tests) {
    if (t.firstMismatch !== undefined) console.log(`  ${t.id}: ${t.firstMismatch}`);
    if (t.firstError !== undefined) console.log(`  ${t.id}: ${t.firstError}`);
  }
}

/** Through a file beside it and a rename, so whoever reads it never sees half a result. */
function write(out: string, result: LoadResult): void {
  mkdirSync(dirname(out), { recursive: true });
  const partial = `${out}.partial`;
  writeFileSync(partial, JSON.stringify(result));
  renameSync(partial, out);
}

async function main(args: string[]): Promise<number> {
  const o = options(args);
  const draw = drawFrom(xorshift(seedOf(o.load.workers)));
  const base: Base = { host: o.host, port: o.port, statuses: o.statuses, run: o.load.values, draw };

  console.log(`priming ${o.tests.length} tests against ${o.load.framework} at ${o.load.target}`);
  const once = await prime(o.tests, base);

  const threads = await spawn(o, once);
  const phases: PhaseResult[] = [];
  try {
    for (const phase of o.load.phases) {
      const ended = phases.some((p) => p.status !== "done");
      const result: PhaseResult = ended
        ? { name: phase.name, rps: phase.rps, status: "notRun" }
        : await runPhase(o, threads, phase);
      phases.push(result);
      print(phase, result);
      if (o.out !== undefined) write(o.out, { load: o.load, testsLive: o.tests.length, phases });
    }
  } finally {
    await Promise.all(threads.map((thread) => thread.terminate()));
  }
  if (o.out !== undefined) console.log(`result -> ${o.out}`);
  return 0;
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  if (error instanceof UsageError) {
    console.error(`${USAGE}\ntraffic-generator: ${error.message}`);
    process.exitCode = 2;
  } else if (error instanceof PrimingError) {
    console.error(`traffic-generator: ${error.message}`);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
