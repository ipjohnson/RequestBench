// One thread's share of the open-loop schedule, for each phase in turn, on the same connections.
//
// An instance is timed from its scheduled moment rather than from when it was sent, which is
// the coordinated-omission correction: a backlog in the generator or the framework shows up as
// latency instead of quietly vanishing. The test is the unit, so the time runs until the
// test's closure settles, however many calls it made.
import http from "node:http";
import { parentPort, workerData } from "node:worker_threads";
import suite from "@rb/tests";
import type { RunValues } from "@rb/tests/kit";
import { drawFrom } from "@rb/tests/models/parameters";
import { MeasuredClient, NOTHING_SENT, Once, describe, xorshift, type Statuses } from "./client.ts";
import { bucketOf } from "./histogram.ts";
import { newTally, type Tally } from "./tally.ts";

/** What the main thread hands each worker once, for every phase. */
export interface Job {
  readonly host: string;
  readonly port: number;
  /** The ids of the tests offered, in the order the report lists them. */
  readonly tests: readonly string[];
  /** This thread takes every `workers`-th instance of a phase, settle and recorded alike, starting at this one. */
  readonly index: number;
  readonly workers: number;
  /** This thread's share of the in-flight limit, which is also its connection limit. */
  readonly inflight: number;
  readonly seed: number;
  readonly statuses: Statuses;
  readonly run: RunValues;
  readonly once: readonly (readonly [string, unknown])[];
}

/** One phase, counted in instances across every thread. */
export interface Schedule {
  readonly rps: number;
  /** Instances that run before the recorded ones, on the same schedule and unrecorded. */
  readonly settle: number;
  /** Recorded instances. */
  readonly total: number;
}

export interface Report {
  readonly tallies: readonly Tally[];
  /** The settle's instances, whichever test they picked. */
  readonly settle: Tally;
  /** Started and still in flight when the drain gave up. */
  readonly unfinished: number;
  /** When the last instance finished, on the clock the start was given on, or 0 when none did. */
  readonly last: bigint;
}

export type FromWorker =
  | { readonly kind: "ready" }
  | { readonly kind: "settled"; readonly dropped: number }
  | { readonly kind: "done"; readonly report: Report };

export type ToWorker =
  | { readonly kind: "phase"; readonly schedule: Schedule; readonly start: bigint }
  | { readonly kind: "stop" };

/** How long the thread waits for what is still in flight once a phase's schedule has run out. */
const DRAIN_MS = 10_000;

if (parentPort === null) throw new Error("worker.ts runs as a worker thread, started by cli.ts");
const port = parentPort;

const job = workerData as Job;
const tests = job.tests.map((id) => suite.tests[id]!);
const random = xorshift(job.seed);
// noDelay reaches net.createConnection through the agent, though AgentOptions does not list it.
const connections: http.AgentOptions & { noDelay: boolean } = {
  keepAlive: true,
  maxSockets: job.inflight,
  maxFreeSockets: job.inflight,
  scheduling: "fifo",
  noDelay: true,
};
const shared = {
  host: job.host,
  port: job.port,
  agent: new http.Agent(connections),
  statuses: job.statuses,
  run: job.run,
  draw: drawFrom(random),
  once: new Once(job.once),
};

/** Not reset between phases, because an instance the drain gave up on still holds its connection. */
let inflight = 0;

interface Phase {
  readonly schedule: Schedule;
  readonly start: bigint;
  readonly periodNs: number;
  readonly end: number;
  readonly tallies: readonly Tally[];
  readonly settle: Tally;
  next: number;
  /** Whether the main thread has this thread's settle drops. */
  told: boolean;
  /** Set when the main thread calls the phase off after judging the settle. */
  stopped: boolean;
  last: bigint;
}

let phase: Phase | undefined;

const due = (p: Phase, k: number): bigint => p.start + BigInt(Math.round(k * p.periodNs));

function tick(): void {
  const p = phase!;
  const now = process.hrtime.bigint();
  while (p.next < p.end && !p.stopped) {
    const at = due(p, p.next);
    if (at > now) break;
    fire(p, p.next, at);
    p.next += job.workers;
  }
  if (!p.told && p.next >= p.schedule.settle) {
    // An instance is dropped at its scheduled moment or not at all, so every drop in this
    // thread's share of the settle is already counted.
    p.told = true;
    port.postMessage({ kind: "settled", dropped: p.settle.dropped } satisfies FromWorker);
  }
  if (p.stopped || p.next >= p.end) return drain(p);
  // setTimeout's floor is about a millisecond, which would land in the latency being measured,
  // so the thread spins on setImmediate unless the next instance is further off than that.
  const wait = Number(due(p, p.next) - process.hrtime.bigint()) / 1e6;
  if (wait > 4) setTimeout(tick, Math.floor(wait) - 1);
  else setImmediate(tick);
}

function fire(p: Phase, k: number, at: bigint): void {
  const t = Math.floor(random() * tests.length);
  // A settle instance counts toward the settle alone, and toward no test's row.
  const tally = k < p.schedule.settle ? p.settle : p.tallies[t]!;
  if (inflight >= job.inflight) {
    // Dropped by never being sent, so it enters no histogram. A rate with drops is reported
    // with its drop count, because percentiles over the survivors flatter a collapse.
    tally.dropped++;
    return;
  }
  inflight++;
  const client = new MeasuredClient(shared);
  let settled: unknown;
  try {
    settled = tests[t]!.request(client);
  } catch (error) {
    failed(tally, error);
    return;
  }
  Promise.resolve(settled).then(
    () => (client.sent === 0 ? failed(tally, new Error(NOTHING_SENT)) : succeeded(p, tally, at, client)),
    (error: unknown) => failed(tally, error),
  );
}

function succeeded(p: Phase, tally: Tally, at: bigint, client: MeasuredClient): void {
  inflight--;
  p.last = process.hrtime.bigint();
  if (client.mismatch !== undefined) {
    tally.mismatch++;
    tally.firstMismatch ??= client.mismatch;
  }
  if (client.untimed) {
    tally.unrecorded++;
    return;
  }
  tally.hist[bucketOf(Number(p.last - at) / 1000)]!++;
  tally.count++;
}

function failed(tally: Tally, error: unknown): void {
  inflight--;
  tally.errors++;
  tally.firstError ??= describe(error);
}

function drain(p: Phase): void {
  const deadline = Date.now() + DRAIN_MS;
  const poll = (): void => {
    if (inflight === 0 || Date.now() >= deadline) report(p);
    else setTimeout(poll, 5);
  };
  poll();
}

function report(p: Phase): void {
  const done: FromWorker = { kind: "done", report: { tallies: p.tallies, settle: p.settle, unfinished: inflight, last: p.last } };
  port.postMessage(done);
}

port.on("message", (message: ToWorker) => {
  if (message.kind === "stop") {
    if (phase !== undefined) phase.stopped = true;
    return;
  }
  const { schedule, start } = message;
  phase = {
    schedule,
    start,
    periodNs: 1e9 / schedule.rps,
    end: schedule.settle + schedule.total,
    tallies: tests.map(newTally),
    settle: newTally(),
    next: job.index,
    told: schedule.settle === 0,
    stopped: false,
    last: 0n,
  };
  tick();
});
port.postMessage({ kind: "ready" } satisfies FromWorker);
