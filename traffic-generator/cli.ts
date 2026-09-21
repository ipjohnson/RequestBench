// The traffic generator. It offers the corpus's performance tests to one framework at a fixed
// rate, picks a test uniformly for each instance, and records each test's latency from the
// moment its instance was scheduled.
//
//   node traffic-generator/cli.ts 127.0.0.1:8080 --framework node:fastify --rps 2500 --seconds 60 \
//     --settle 15 --abort-drop-fraction 0.05 --out rung.json
//   node traffic-generator/cli.ts 127.0.0.1:8080 --framework node:fastify --rps 1000 --seconds 30 \
//     --slices 1,2,3,4,5,6,7,8,9,10,20,30 --first json.small --out warmup.json
//
// --settle runs the same rate for that many seconds before recording starts, in the same process,
// so the framework, the connections and the generator itself have adjusted to the rate by then.
// With --abort-drop-fraction, a settle that dropped more than that share of its instances ends the
// run there, because a framework dropping that much in the settle goes on dropping at that rate.
// The result then carries the settle and no latency.
//
// --values is the run's values as one JSON object, so every client in a run sends the same ones.
// Without it the generator draws its own. --slices also records the schedule as a ramp, one
// histogram per slice, and --first sends one test on its own connection before anything else and
// times it apart. The full result, histograms included, goes to --out.
import { randomInt } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import http from "node:http";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { Worker } from "node:worker_threads";
import { gzipSync } from "node:zlib";
import suite from "@rb/tests";
import { idOf } from "@rb/tests/kit";
import type { PerformanceTest, RunValues } from "@rb/tests/kit";
import { drawFrom, drawRunValues, runValuesSchema } from "@rb/tests/models/parameters";
import exceptions, { type FrameworkId } from "../frameworks/exceptions.ts";
import {
  MeasuredClient,
  NOTHING_SENT,
  Once,
  OnceRefused,
  describe,
  xorshift,
  type Shared,
  type Statuses,
} from "./client.ts";
import { BUCKETS, addInto, countOf, percentile } from "./histogram.ts";
import { mergeSlice, mergeTally, newSlice, newTally, type Tally } from "./tally.ts";
import type { FromWorker, Job, Report, ToWorker } from "./worker.ts";

const USAGE = [
  "usage: node traffic-generator/cli.ts <host:port> --framework <language:name> --rps <n> --seconds <n>",
  "         [--settle <s> [--abort-drop-fraction <f>]] [--workers <n>] [--max-inflight <n>]",
  "         [--only <test|family>,...] [--values <json>] [--slices <s>,...] [--first <test>] [--out <file>]",
].join("\n");

class UsageError extends Error {}
class PrimingError extends Error {}

const FLAGS = {
  framework: { type: "string" },
  rps: { type: "string" },
  seconds: { type: "string" },
  settle: { type: "string" },
  "abort-drop-fraction": { type: "string" },
  workers: { type: "string", default: "4" },
  "max-inflight": { type: "string", default: "1024" },
  only: { type: "string" },
  values: { type: "string" },
  slices: { type: "string" },
  first: { type: "string" },
  out: { type: "string" },
} as const;

interface Options {
  readonly host: string;
  readonly port: number;
  readonly framework: FrameworkId;
  readonly statuses: Statuses;
  readonly rps: number;
  readonly seconds: number;
  /** Seconds at the same rate before recording starts. */
  readonly settle: number | undefined;
  /** The share of the settle's instances that may be dropped before the run is called off. */
  readonly abort: number | undefined;
  readonly workers: number;
  readonly maxInflight: number;
  readonly tests: readonly PerformanceTest[];
  readonly run: RunValues;
  readonly edges: readonly number[];
  readonly first: PerformanceTest | undefined;
  readonly out: string | undefined;
}

function options(args: string[]): Options {
  let parsed;
  try {
    parsed = parseArgs({ args, options: FLAGS, allowPositionals: true });
  } catch (error) {
    throw new UsageError((error as Error).message);
  }
  const { values: v, positionals } = parsed;
  if (positionals.length !== 1) throw new UsageError("name the framework's address once, as host:port");
  const [framework, statuses] = declared(v.framework);
  const seconds = positive("seconds", v.seconds, false);
  const settle = v.settle === undefined ? undefined : positive("settle", v.settle, false);
  const tests = select(v.only);
  return {
    ...address(positionals[0]!),
    framework,
    statuses,
    rps: positive("rps", v.rps, false),
    seconds,
    settle,
    abort: abortOf(v["abort-drop-fraction"], settle),
    workers: positive("workers", v.workers, true),
    maxInflight: positive("max-inflight", v["max-inflight"], true),
    tests,
    run: runValuesOf(v.values),
    edges: edgesOf(v.slices, seconds),
    first: firstOf(v.first, tests),
    out: v.out,
  };
}

function address(text: string): { host: string; port: number } {
  const m = /^([^:]+):(\d+)$/.exec(text);
  const port = Number(m?.[2]);
  if (m === null || port < 1 || port > 65535) throw new UsageError(`the address is host:port, not ${text}`);
  return { host: m[1]!, port };
}

function positive(flag: string, text: string | undefined, whole: boolean): number {
  if (text === undefined) throw new UsageError(`--${flag} is required`);
  const n = Number(text);
  if (!(n > 0 && Number.isFinite(n)) || (whole && !Number.isInteger(n))) {
    throw new UsageError(`--${flag} has to be a positive ${whole ? "whole number" : "number"}, not ${text}`);
  }
  return n;
}

function abortOf(text: string | undefined, settle: number | undefined): number | undefined {
  if (text === undefined) return undefined;
  if (settle === undefined) throw new UsageError("--abort-drop-fraction judges the settle, so it needs --settle");
  const fraction = Number(text);
  if (!(fraction >= 0 && fraction <= 1)) {
    throw new UsageError(`--abort-drop-fraction has to be from 0 to 1, not ${text}`);
  }
  return fraction;
}

/**
 * The statuses this framework declared. Not defaulted: rejected(), notFound(), wrongMethod()
 * and unparseable() compare against them, so a run that does not know which framework it is
 * measuring cannot tell a right answer from a wrong one.
 */
function declared(id: string | undefined): [FrameworkId, Statuses] {
  const known = Object.keys(exceptions).join(", ");
  if (id === undefined) throw new UsageError(`--framework is required, one of ${known}`);
  if (!Object.hasOwn(exceptions, id)) {
    throw new UsageError(`--framework ${id} has no client-exception declaration, only ${known} do`);
  }
  const { rejected, malformed, notFound, wrongMethod } = exceptions[id as FrameworkId];
  return [id as FrameworkId, { rejected, malformed, notFound, wrongMethod }];
}

/** The performance tests to offer, by id. `--only` names a test by its id, or a whole family by its name. */
function select(only: string | undefined): PerformanceTest[] {
  const measured = Object.values(suite.tests)
    .filter((test): test is PerformanceTest => test.kind === "performance")
    .sort((a, b) => (idOf(a.id) < idOf(b.id) ? -1 : 1));
  if (only === undefined) return measured;

  const wanted = new Set<string>();
  for (const name of only.split(",").map((s) => s.trim()).filter((s) => s !== "")) {
    if (Object.hasOwn(suite.tests, name)) {
      if (suite.tests[name]!.kind !== "performance") {
        throw new UsageError(`--only ${name} is a validation test, which is never timed`);
      }
      wanted.add(name);
    } else if (Object.hasOwn(suite.families, name)) {
      for (const test of measured) if (test.id.family === name) wanted.add(idOf(test.id));
    } else {
      throw new UsageError(`--only ${name} is neither a test nor a family`);
    }
  }
  const chosen = measured.filter((test) => wanted.has(idOf(test.id)));
  if (chosen.length === 0) throw new UsageError(`--only ${only} names no performance test`);
  return chosen;
}

function runValuesOf(text: string | undefined): RunValues {
  // Drawn here, a run's values have to come from a source no framework can read.
  if (text === undefined) return drawRunValues(() => randomInt(2 ** 47) / 2 ** 47);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new UsageError(`--values is not JSON: ${(error as Error).message}`);
  }
  const parsed = runValuesSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "the object"}: ${i.message}`);
    throw new UsageError(`--values ${issues.join("; ")}`);
  }
  return parsed.data;
}

function edgesOf(text: string | undefined, seconds: number): number[] {
  if (text === undefined) return [];
  const edges = text.split(",").map(Number);
  const rising = edges.every((edge, i) => edge > (i === 0 ? 0 : edges[i - 1]!));
  if (!rising || edges.at(-1) !== seconds) {
    throw new UsageError(`--slices ${text} has to rise from above 0 to --seconds ${seconds}`);
  }
  return edges;
}

function firstOf(id: string | undefined, tests: readonly PerformanceTest[]): PerformanceTest | undefined {
  if (id === undefined) return undefined;
  const test = tests.find((t) => idOf(t.id) === id);
  if (test === undefined) throw new UsageError(`--first ${id} is not one of the tests being offered`);
  return test;
}

/** Seeds for the worker threads, and one past them for this thread. */
const seedOf = (i: number): number => Math.imul(0x9e3779b9, i + 1) >>> 0;

type Base = Omit<Shared, "agent" | "once">;

interface First {
  readonly test: string;
  readonly us: number;
  readonly status?: number;
  readonly mismatch?: string;
  readonly error?: string;
}

/**
 * One test on a connection of its own, before priming and before anything else, so it is the
 * first request the framework serves after its readiness probe. On a cold runtime it pays for
 * class loading, static initialisation and the first compile of its path, which inside a slice
 * would be one sample among thousands.
 */
async function sendFirst(test: PerformanceTest, base: Base): Promise<First> {
  const id = idOf(test.id);
  const agent = new http.Agent({ keepAlive: false });
  const client = new MeasuredClient({ ...base, agent, once: new Once([], "refuse") });
  const started = process.hrtime.bigint();
  const took = () => Math.round(Number(process.hrtime.bigint() - started) / 1000);
  try {
    await test.request(client);
    const us = took();
    const mismatch = client.mismatch === undefined ? {} : { mismatch: client.mismatch };
    return { test: id, us, status: client.status, ...mismatch };
  } catch (error) {
    if (error instanceof OnceRefused) {
      throw new UsageError(`--first ${id} reaches ${error.message}, which has no value until priming has run`);
    }
    return { test: id, us: took(), error: describe(error) };
  } finally {
    agent.destroy();
  }
}

/**
 * Every test once, in turn on one connection, before anything is timed. This makes each once()
 * value, so the load never has to, and it refuses a test that cannot be sent at all before a
 * rung is spent finding that out in every instance.
 */
async function prime(tests: readonly PerformanceTest[], base: Base): Promise<[string, unknown][]> {
  const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });
  const once = new Once([], "make");
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
      // A wrong status is the framework's answer, not a test that cannot be sent, so the run
      // goes on and the load counts it in every instance.
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

async function load(
  o: Options,
  counts: { readonly settle: number; readonly total: number },
  once: [string, unknown][],
): Promise<{ start: bigint; aborted: boolean; reports: Report[] }> {
  const tests = o.tests.map((test) => idOf(test.id));
  const workers = Array.from({ length: o.workers }, (_, index) => {
    const job: Job = {
      host: o.host,
      port: o.port,
      tests,
      rps: o.rps,
      settle: counts.settle,
      total: counts.total,
      index,
      workers: o.workers,
      inflight: Math.ceil(o.maxInflight / o.workers),
      seed: seedOf(index),
      statuses: o.statuses,
      run: o.run,
      once,
      edges: o.edges,
    };
    return new Worker(new URL("./worker.ts", import.meta.url), { workerData: job });
  });
  try {
    await Promise.all(workers.map((worker) => next(worker, "ready")));
    const done = Promise.all(workers.map((worker) => next(worker, "done")));
    // Awaited once the settle is judged. Until then this keeps a thread that fails from being
    // reported as an unhandled rejection instead of as its own error.
    done.catch(() => {});
    // Judged on the drops of every thread together, so no thread goes on while another stops.
    const judging =
      o.abort === undefined || counts.settle === 0
        ? undefined
        : { limit: o.abort, settled: Promise.all(workers.map((worker) => next(worker, "settled"))) };
    // One start for every thread, far enough ahead that it reaches each of them before it
    // passes, so an instance is due at the same moment whichever thread holds it.
    const start = process.hrtime.bigint() + 50_000_000n;
    for (const worker of workers) worker.postMessage({ kind: "start", start } satisfies ToWorker);
    let aborted = false;
    if (judging !== undefined) {
      const dropped = (await judging.settled).reduce((sum, message) => sum + message.dropped, 0);
      aborted = dropped / counts.settle > judging.limit;
      if (aborted) for (const worker of workers) worker.postMessage({ kind: "stop" } satisfies ToWorker);
    }
    return { start, aborted, reports: (await done).map((message) => message.report) };
  } finally {
    await Promise.all(workers.map((worker) => worker.terminate()));
  }
}

const percentiles = (hist: Uint32Array) => ({
  p50_us: percentile(hist, 50),
  p90_us: percentile(hist, 90),
  p99_us: percentile(hist, 99),
  p999_us: percentile(hist, 99.9),
});

const base64 = (hist: Uint32Array): Buffer => Buffer.from(hist.buffer, hist.byteOffset, hist.byteLength);

/** The recorded instances. `from` is the moment the first of them was due. */
function recordedSummary(o: Options, total: number, from: bigint, reports: readonly Report[]) {
  const tallies = o.tests.map(newTally);
  const slices = o.edges.map(newSlice);
  let unfinished = 0;
  let last = from;
  for (const report of reports) {
    report.tallies.forEach((tally, i) => mergeTally(tallies[i]!, tally));
    report.slices.forEach((slice, i) => mergeSlice(slices[i]!, slice));
    unfinished += report.unfinished;
    if (report.last > last) last = report.last;
  }
  const overall = new Uint32Array(BUCKETS);
  for (const tally of tallies) addInto(overall, tally.hist);
  const sum = (field: (tally: Tally) => number) => tallies.reduce((s, tally) => s + field(tally), 0);
  const unrecorded = sum((t) => t.unrecorded);
  const completed = countOf(overall) + unrecorded;
  const elapsed = last > from ? Number(last - from) / 1e9 : o.seconds;

  return {
    elapsed_s: Number(elapsed.toFixed(2)),
    achieved_rps: Math.round(completed / elapsed),
    scheduled: total,
    completed,
    dropped: sum((t) => t.dropped),
    errors: sum((t) => t.errors),
    status_mismatch: sum((t) => t.mismatch),
    unrecorded,
    unfinished,
    overall: { count: countOf(overall), ...percentiles(overall) },
    tests: o.tests.map((test, i) => {
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
        ...(t.firstMismatch === undefined ? {} : { first_mismatch: t.firstMismatch }),
        ...(t.firstError === undefined ? {} : { first_error: t.firstError }),
        hist_b64: base64(t.hist).toString("base64"),
      };
    }),
    ...(o.edges.length === 0
      ? {}
      : {
          // A request belongs to the slice its scheduled moment falls in, not the one it
          // finished in, so a backlog shows up as latency in the second that caused it.
          slices: slices.map((slice, i) => {
            const at = i === 0 ? 0 : o.edges[i - 1]!;
            return {
              start_s: at,
              seconds: o.edges[i]! - at,
              count: countOf(slice.hist),
              errors: slice.errors,
              mismatch: slice.mismatch,
              dropped: slice.dropped,
              p50_us: percentile(slice.hist, 50),
              p99_us: percentile(slice.hist, 99),
              hist_gz: gzipSync(base64(slice.hist), { level: 9 }).toString("base64"),
            };
          }),
        }),
  };
}

/** The settle's instances, summed over every test, because none of them is published as a latency. */
function settleSummary(
  seconds: number,
  scheduled: number,
  limit: number | undefined,
  reports: readonly Report[],
  aborted: boolean,
) {
  const t = newTally();
  for (const report of reports) mergeTally(t, report.settle);
  const completed = t.count + t.unrecorded;
  return {
    seconds,
    scheduled,
    completed,
    achieved_rps: Math.round(completed / seconds),
    dropped: t.dropped,
    drop_fraction: scheduled === 0 ? 0 : t.dropped / scheduled,
    ...(limit === undefined ? {} : { abort_drop_fraction: limit }),
    aborted,
    errors: t.errors,
    mismatch: t.mismatch,
    p50_us: percentile(t.hist, 50),
    p99_us: percentile(t.hist, 99),
    ...(t.firstMismatch === undefined ? {} : { first_mismatch: t.firstMismatch }),
    ...(t.firstError === undefined ? {} : { first_error: t.firstError }),
  };
}

type SettleSummary = ReturnType<typeof settleSummary>;
type RecordedSummary = ReturnType<typeof recordedSummary>;

function print(o: Options, settle: SettleSummary | undefined, r: RecordedSummary | undefined): void {
  if (settle !== undefined) {
    console.log(
      `settle: ${settle.completed} of ${settle.scheduled} completed over ${settle.seconds}s, ` +
        `${settle.dropped} dropped (${(settle.drop_fraction * 100).toFixed(1)}%), p99 ${settle.p99_us}us`,
    );
    if (settle.aborted) {
      console.log(`  more than the ${o.abort} allowed, so the recorded ${o.seconds}s were not run`);
      if (settle.first_mismatch !== undefined) console.log(`  ${settle.first_mismatch}`);
      if (settle.first_error !== undefined) console.log(`  ${settle.first_error}`);
    }
  }
  if (r === undefined) return;

  const width = Math.max("overall".length, ...r.tests.map((t) => t.id.length));
  const row = (name: string, ...cells: (string | number)[]) =>
    `  ${name.padEnd(width)}${cells.map((cell) => String(cell).padStart(10)).join("")}`;
  console.log(row("test", "count", "p50_us", "p99_us", "mismatch", "errors", "dropped"));
  for (const t of r.tests) console.log(row(t.id, t.count, t.p50_us, t.p99_us, t.mismatch, t.errors, t.dropped));
  const all = r.overall;
  console.log(row("overall", all.count, all.p50_us, all.p99_us, r.status_mismatch, r.errors, r.dropped));
  console.log(
    `\n${r.achieved_rps} rps achieved over ${r.elapsed_s}s: ${r.completed} of ${r.scheduled} completed, ` +
      `${r.dropped} dropped, ${r.errors} errors, ${r.unfinished} unfinished`,
  );
  for (const t of r.tests) {
    if (t.first_mismatch !== undefined) console.log(`  ${t.id}: ${t.first_mismatch}`);
    if (t.first_error !== undefined) console.log(`  ${t.id}: ${t.first_error}`);
  }
  if (r.slices !== undefined) {
    const [head, tail] = [r.slices[0]!, r.slices.at(-1)!];
    console.log(
      `ramp: p99 ${head.p99_us}us in the first ${head.seconds}s, ${tail.p99_us}us in the last ${tail.seconds}s`,
    );
  }
}

async function main(args: string[]): Promise<number> {
  const o = options(args);
  const draw = drawFrom(xorshift(seedOf(o.workers)));
  const base: Base = { host: o.host, port: o.port, statuses: o.statuses, run: o.run, draw };

  const first = o.first === undefined ? undefined : await sendFirst(o.first, base);
  if (first !== undefined) {
    const mismatch = first.mismatch === undefined ? "" : `, ${first.mismatch}`;
    console.log(`first ${first.test} ${first.error ?? first.status} in ${first.us}us${mismatch}`);
  }

  console.log(`priming ${o.tests.length} tests against ${o.framework} at ${o.host}:${o.port}`);
  const once = await prime(o.tests, base);

  const settle = o.settle === undefined ? 0 : Math.round(o.rps * o.settle);
  const total = Math.round(o.rps * o.seconds);
  const lead = o.settle === undefined ? "" : `${o.settle}s to settle, then `;
  const recording = `${total} instances recorded over ${o.seconds}s`;
  console.log(`offering ${o.rps} rps over ${o.workers} threads: ${lead}${recording}`);
  const { start, aborted, reports } = await load(o, { settle, total }, once);

  // The recorded instances carry on the settle's schedule, so the first of them is due where it ends.
  const from = start + BigInt(Math.round((settle * 1e9) / o.rps));
  const settled = o.settle === undefined ? undefined : settleSummary(o.settle, settle, o.abort, reports, aborted);
  const recorded = aborted ? undefined : recordedSummary(o, total, from, reports);
  print(o, settled, recorded);

  if (o.out !== undefined) {
    const result = {
      target: `${o.host}:${o.port}`,
      framework: o.framework,
      offered_rps: o.rps,
      seconds: o.seconds,
      workers: o.workers,
      max_inflight: o.maxInflight,
      tests_live: o.tests.length,
      values: o.run,
      ...(first === undefined ? {} : { first }),
      ...(settled === undefined ? {} : { settle: settled }),
      ...recorded,
    };
    mkdirSync(dirname(o.out), { recursive: true });
    writeFileSync(o.out, JSON.stringify(result));
    console.log(`result -> ${o.out}`);
  }
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
