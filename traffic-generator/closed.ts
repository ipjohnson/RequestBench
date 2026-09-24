// A closed loop on the Lambda Runtime API. The Rust program already serves the function's runtime
// through `pipe`. primeClosed primes every performance test through one function, and runClosed
// hands the compiled events to another and turns each phase's spans into the result, so the
// measured function answers nothing before its first recorded event. Nothing here times anything.
import type { PerformanceTest, RunValues } from "@rb/tests/kit";
import { idOf } from "@rb/tests/kit";
import { BUCKETS, addInto, countOf, percentile } from "./histogram.ts";
import type { ClosedPhase, ClosedPhaseResult, ClosedResult, ClosedTestSummary, Percentiles, SpanSummary } from "./load.ts";
import type { ClosedReport, Pipe, WireSpans } from "./pipe.ts";
import { prepare } from "./prepare.ts";
import { declared, select } from "./select.ts";

export interface ClosedOptions {
  readonly pipe: Pipe;
  readonly framework: string;
  readonly values: RunValues;
  /** The most requests compiled per test, as an open-loop load compiles them. */
  readonly instances: number;
  /** Test ids or family names, as a load's `only` names them. Absent means every performance test. */
  readonly only?: readonly string[] | undefined;
  readonly unsupported?: Readonly<Record<string, string>> | undefined;
  readonly log: (line: string) => void;
}

/** Every performance test, compiled against a function the load does not measure. */
export interface Primed {
  readonly tests: readonly PerformanceTest[];
  readonly compiled: Awaited<ReturnType<typeof prepare>>;
}

const decode = (b64: string): Uint32Array => {
  const bytes = Buffer.from(b64, "base64");
  const hist = new Uint32Array(BUCKETS);
  for (let i = 0; i < BUCKETS; i++) hist[i] = bytes.readUInt32LE(i * 4);
  return hist;
};

const percentiles = (hist: Uint32Array): Percentiles => ({
  p50Us: percentile(hist, 50),
  p90Us: percentile(hist, 90),
  p99Us: percentile(hist, 99),
  p999Us: percentile(hist, 99.9),
});

const span = (b64: string): SpanSummary => ({ ...percentiles(decode(b64)), histB64: b64 });

const optional = (name: "firstError" | "firstMismatch", value: string | null) => (value === null ? {} : { [name]: value });

const us = (ns: number): number => Math.round(ns / 100) / 10;

/** The first recorded invocation, and each second's invocations and mean invoke phase. */
function start(report: ClosedReport, tests: readonly PerformanceTest[]) {
  const f = report.firstInvocation;
  const first =
    f === null
      ? {}
      : {
          first: {
            id: idOf(tests[f.test]!.id),
            invokeUs: us(f.invoke),
            responseUs: us(f.response),
            responseLatencyUs: us(f.responseLatency),
            responseDurationUs: us(f.responseDuration),
            runtimeOverheadUs: us(f.runtimeOverhead),
          },
        };
  return {
    ...first,
    perSecond: report.seconds.map(([invocations, invokeNs]) => ({ invocations, meanInvokeUs: invocations === 0 ? 0 : us(invokeNs / invocations) })),
  };
}

export async function primeClosed(o: ClosedOptions): Promise<Primed> {
  const tests = select(o.only, o.unsupported);
  o.log(`priming ${tests.length} tests against ${o.framework} on the Lambda Runtime API`);
  const compiled = await prepare({ pipe: o.pipe, tests, statuses: declared(o.framework), run: o.values, instances: o.instances, log: o.log });
  return { tests, compiled };
}

export async function runClosed(o: ClosedOptions & { readonly phases: readonly ClosedPhase[] }, primed: Primed): Promise<ClosedResult> {
  const { tests, compiled } = primed;
  await o.pipe.open(
    compiled.map((test) => ({
      instances: test.instances.map((i) => ({ request: i.request, label: i.target, accepted: i.accepted, bodyBytes: i.bodyBytes ?? null })),
    })),
    { workers: 1, connections: 1, streams: 1 },
  );
  const phases: ClosedPhaseResult[] = [];
  for (const phase of o.phases) {
    o.log(`${phase.name}: a closed loop${phase.settle === undefined ? "" : `, ${phase.settle}s to settle`}${phase.seconds === undefined ? "" : `, ${phase.seconds}s recorded`}`);
    const report = await o.pipe.closedPhase({ settleSeconds: phase.settle ?? 0, seconds: phase.seconds ?? 0 });
    const settled = report.settle;
    const settle =
      phase.settle === undefined
        ? {}
        : {
            settle: {
              seconds: phase.settle,
              invocations: settled.count + settled.errors,
              errors: settled.errors,
              mismatch: settled.mismatch,
              ...optional("firstError", settled.firstError),
              ...optional("firstMismatch", settled.firstMismatch),
            },
          };
    let recorded = {};
    if (phase.seconds !== undefined) {
      const rows: ClosedTestSummary[] = report.tests.map((t: WireSpans, i) => ({
        id: idOf(tests[i]!.id),
        family: tests[i]!.id.family,
        count: t.count,
        errors: t.errors,
        mismatch: t.mismatch,
        ...optional("firstError", t.firstError),
        ...optional("firstMismatch", t.firstMismatch),
        invoke: span(t.invoke),
        response: span(t.response),
        responseLatency: span(t.responseLatency),
        responseDuration: span(t.responseDuration),
        runtimeOverhead: span(t.runtimeOverhead),
      }));
      const overall = new Uint32Array(BUCKETS);
      for (const t of report.tests) addInto(overall, decode(t.invoke));
      const invocations = rows.reduce((n, t) => n + t.count + t.errors, 0);
      const elapsed = report.last > report.first ? (report.last - report.first) / 1e9 : phase.seconds;
      recorded = {
        recorded: {
          seconds: phase.seconds,
          elapsedSeconds: Number(elapsed.toFixed(2)),
          invocations,
          invocationsPerSecond: Math.round(invocations / elapsed),
          errors: rows.reduce((n, t) => n + t.errors, 0),
          mismatch: rows.reduce((n, t) => n + t.mismatch, 0),
          overall: { count: countOf(overall), ...percentiles(overall) },
          ...start(report, tests),
          tests: rows,
        },
      };
    }
    phases.push({ name: phase.name, status: "done", ...settle, ...recorded });
  }
  return {
    closed: true,
    load: {
      framework: o.framework,
      values: o.values,
      instances: o.instances,
      ...(o.only === undefined ? {} : { only: [...o.only] }),
      ...(o.unsupported === undefined ? {} : { unsupported: o.unsupported }),
      phases: o.phases,
    },
    testsLive: tests.length,
    phases,
  };
}
