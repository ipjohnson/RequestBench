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
// This process runs the corpus: it primes every test through the Rust program in src/ and
// hands it the compiled load. The program does the timing, and this turns its tallies into the
// result. The full result, histograms included, goes to --out after every phase.
import { randomInt } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import suite from "@rb/tests";
import { idOf } from "@rb/tests/kit";
import type { PerformanceTest } from "@rb/tests/kit";
import { drawRunValues } from "@rb/tests/models/parameters";
import exceptions, { type FrameworkId } from "../frameworks/exceptions.ts";
import { BUCKETS, addInto, countOf, percentile } from "./histogram.ts";
import { PrepareError, prepare, type Compiled, type Statuses } from "./prepare.ts";
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
import { Pipe, type PhaseReport } from "./pipe.ts";
import { tallyOf, type Tally } from "./tally.ts";

const USAGE = "usage: node traffic-generator/cli.ts <load, as JSON or a file> [--out <file>]";

class UsageError extends Error {}

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
  return { load, host, port, statuses: declared(load.framework), tests: select(load.only, load.unsupported), out: v.out };
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

/**
 * The performance tests to offer, by id. `only` names a test by its id, or a whole family by its
 * name. A test the framework cannot answer on its host is left out whatever `only` says.
 */
function select(only: readonly string[] | undefined, unsupported: Readonly<Record<string, string>> = {}): PerformanceTest[] {
  for (const id of Object.keys(unsupported)) {
    if (!Object.hasOwn(suite.tests, id)) throw new UsageError(`unsupported: ${id} is not a test`);
  }
  const measured = Object.values(suite.tests)
    .filter((test): test is PerformanceTest => test.kind === "performance" && !Object.hasOwn(unsupported, idOf(test.id)))
    .sort((a, b) => (idOf(a.id) < idOf(b.id) ? -1 : 1));
  if (measured.length === 0) throw new UsageError("unsupported: leaves no performance test to offer");
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

const percentiles = (hist: Uint32Array): Percentiles => ({
  p50Us: percentile(hist, 50),
  p90Us: percentile(hist, 90),
  p99Us: percentile(hist, 99),
  p999Us: percentile(hist, 99.9),
});

const base64 = (hist: Uint32Array): string =>
  Buffer.from(hist.buffer, hist.byteOffset, hist.byteLength).toString("base64");

/** The settle's instances, summed over every test. */
function settleSummary(seconds: number, scheduled: number, t: Tally): SettleSummary {
  const completed = t.count;
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

/** The recorded instances. `from` is the moment the first of them was due, and `last` when the last answer ended. */
function recordedSummary(
  tests: readonly PerformanceTest[],
  seconds: number,
  scheduled: number,
  from: number,
  last: number,
  tallies: readonly Tally[],
): RecordedSummary {
  const overall = new Uint32Array(BUCKETS);
  for (const tally of tallies) addInto(overall, tally.hist);
  const sum = (field: (tally: Tally) => number) => tallies.reduce((s, tally) => s + field(tally), 0);
  const completed = countOf(overall);
  const elapsed = last > from ? (last - from) / 1e9 : seconds;

  return {
    seconds,
    elapsedSeconds: Number(elapsed.toFixed(2)),
    achievedRps: Math.round(completed / elapsed),
    scheduled,
    completed,
    dropped: sum((t) => t.dropped),
    errors: sum((t) => t.errors),
    mismatch: sum((t) => t.mismatch),
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
        ...percentiles(t.hist),
        ...(t.firstMismatch === undefined ? {} : { firstMismatch: t.firstMismatch }),
        ...(t.firstError === undefined ? {} : { firstError: t.firstError }),
        histB64: base64(t.hist),
      };
    }),
  };
}

async function runPhase(o: Options, pipe: Pipe, phase: Phase): Promise<PhaseResult> {
  // One phase, counted in instances across every thread.
  const schedule = {
    rps: phase.rps,
    settle: Math.round(phase.rps * (phase.settle ?? 0)),
    total: Math.round(phase.rps * (phase.seconds ?? 0)),
  };
  const parts = [
    ...(phase.settle === undefined ? [] : [`${phase.settle}s to settle`]),
    ...(phase.seconds === undefined ? [] : [`${schedule.total} instances recorded over ${phase.seconds}s`]),
  ];
  console.log(`${phase.name}: offering ${phase.rps} rps over ${o.load.workers} threads: ${parts.join(", then ")}`);

  const report: PhaseReport = await pipe.phase({ ...schedule, abortDropFraction: phase.abortDropFraction ?? null });
  const { aborted, unfinished } = report;
  // The recorded instances carry on the settle's schedule, so the first of them is due where it ends.
  const from = report.start + Math.round((schedule.settle * 1e9) / phase.rps);
  const settle = phase.settle === undefined ? {} : { settle: settleSummary(phase.settle, schedule.settle, tallyOf(report.settle)) };
  const recorded =
    phase.seconds === undefined || aborted
      ? {}
      : { recorded: recordedSummary(o.tests, phase.seconds, schedule.total, from, report.last, report.tests.map(tallyOf)) };
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

  const left = Object.keys(o.load.unsupported ?? {}).filter((id) => suite.tests[id]?.kind === "performance");
  if (left.length > 0) console.log(`leaving out ${left.length} test(s) ${o.load.framework} does not support here: ${left.join(", ")}`);
  console.log(`priming ${o.tests.length} tests against ${o.load.framework} at ${o.load.target}`);
  const pipe = Pipe.start({ host: o.host, port: o.port });
  const phases: PhaseResult[] = [];
  try {
    const compiled = await prepare({
      pipe,
      tests: o.tests,
      statuses: o.statuses,
      run: o.load.values,
      instances: o.load.instances,
      log: (line) => console.log(line),
    });
    const requests = compiled.reduce((n, test) => n + test.instances.length, 0);
    console.log(`  ${requests} requests prepared, at most ${Math.max(...compiled.map((test) => test.instances.length))} for one test`);

    // Every thread and connection is opened before the first phase, and kept for every phase after it.
    const tests = compiled.map((test) => ({
      instances: test.instances.map((i) => ({ request: i.request, label: i.target, accepted: i.accepted, bodyBytes: i.bodyBytes ?? null })),
    }));
    await pipe.open(tests, o.load.workers, o.load.connections);
    for (const phase of o.load.phases) {
      const ended = phases.some((p) => p.status !== "done");
      const result: PhaseResult = ended
        ? { name: phase.name, rps: phase.rps, status: "notRun" }
        : await runPhase(o, pipe, phase);
      phases.push(result);
      print(phase, result);
      if (o.out !== undefined) write(o.out, { load: o.load, testsLive: o.tests.length, phases });
    }
  } finally {
    await pipe.close();
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
  } else if (error instanceof PrepareError) {
    console.error(`traffic-generator: ${error.message}`);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
