// One thread's share of the open-loop schedule.
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
import { newSlice, newTally, type Slice, type Tally } from "./tally.ts";

/** What the main thread hands each worker. */
export interface Job {
  readonly host: string;
  readonly port: number;
  /** The ids of the tests offered, in the order the report lists them. */
  readonly tests: readonly string[];
  readonly rps: number;
  /**
   * Instances across every thread that run before the recorded ones, on the same schedule and
   * unrecorded, so connections and the generator are warm when recording starts.
   */
  readonly settle: number;
  /** Recorded instances across every thread. */
  readonly total: number;
  /** This thread takes every `workers`-th instance, settle and recorded alike, starting at this one. */
  readonly index: number;
  readonly workers: number;
  /** This thread's share of the in-flight limit, which is also its connection limit. */
  readonly inflight: number;
  readonly seed: number;
  readonly statuses: Statuses;
  readonly run: RunValues;
  readonly once: readonly (readonly [string, unknown])[];
  /** Where each slice of the schedule ends, in seconds. Empty when the load is not sliced. */
  readonly edges: readonly number[];
}

export interface Report {
  readonly tallies: readonly Tally[];
  readonly slices: readonly Slice[];
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

export type ToWorker = { readonly kind: "start"; readonly start: bigint } | { readonly kind: "stop" };

/** How long the thread waits for what is still in flight once the schedule has run out. */
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
  once: new Once(job.once, "make"),
};
const tallies = tests.map(newTally);
const slices = job.edges.map(newSlice);
const settle = newTally();
const periodNs = 1e9 / job.rps;
const end = job.settle + job.total;

let start = 0n;
let next = job.index;
let slice = 0;
let inflight = 0;
let last = 0n;
/** Whether the main thread has this thread's settle drops. */
let told = job.settle === 0;
/** Set when the main thread calls the run off after judging the settle. */
let stopped = false;

const due = (k: number): bigint => start + BigInt(Math.round(k * periodNs));

/** The slice an instance's scheduled moment falls in. Instances come in order, so it only moves forward. */
function sliceOf(k: number): Slice | undefined {
  if (slices.length === 0) return undefined;
  const at = (k - job.settle) / job.rps;
  while (slice < slices.length - 1 && at >= job.edges[slice]!) slice++;
  return slices[slice];
}

function tick(): void {
  const now = process.hrtime.bigint();
  while (next < end && !stopped) {
    const at = due(next);
    if (at > now) break;
    fire(next, at);
    next += job.workers;
  }
  if (!told && next >= job.settle) {
    // An instance is dropped at its scheduled moment or not at all, so every drop in this
    // thread's share of the settle is already counted.
    told = true;
    port.postMessage({ kind: "settled", dropped: settle.dropped } satisfies FromWorker);
  }
  if (stopped || next >= end) return drain();
  // setTimeout's floor is about a millisecond, which would land in the latency being measured,
  // so the thread spins on setImmediate unless the next instance is further off than that.
  const wait = Number(due(next) - process.hrtime.bigint()) / 1e6;
  if (wait > 4) setTimeout(tick, Math.floor(wait) - 1);
  else setImmediate(tick);
}

function fire(k: number, at: bigint): void {
  const t = Math.floor(random() * tests.length);
  // A settle instance counts toward the settle alone, and toward no test's row or slice.
  const settling = k < job.settle;
  const tally = settling ? settle : tallies[t]!;
  const into = settling ? undefined : sliceOf(k);
  if (inflight >= job.inflight) {
    // Dropped by never being sent, so it enters no histogram. A rate with drops is reported
    // with its drop count, because percentiles over the survivors flatter a collapse.
    tally.dropped++;
    if (into) into.dropped++;
    return;
  }
  inflight++;
  const client = new MeasuredClient(shared);
  let settled: unknown;
  try {
    settled = tests[t]!.request(client);
  } catch (error) {
    failed(tally, into, error);
    return;
  }
  Promise.resolve(settled).then(
    () => (client.sent === 0 ? failed(tally, into, new Error(NOTHING_SENT)) : succeeded(tally, into, at, client)),
    (error: unknown) => failed(tally, into, error),
  );
}

function succeeded(tally: Tally, into: Slice | undefined, at: bigint, client: MeasuredClient): void {
  inflight--;
  last = process.hrtime.bigint();
  if (client.mismatch !== undefined) {
    tally.mismatch++;
    tally.firstMismatch ??= client.mismatch;
    if (into) into.mismatch++;
  }
  if (client.untimed) {
    tally.unrecorded++;
    return;
  }
  const bucket = bucketOf(Number(last - at) / 1000);
  tally.hist[bucket]!++;
  tally.count++;
  if (into) into.hist[bucket]!++;
}

function failed(tally: Tally, into: Slice | undefined, error: unknown): void {
  inflight--;
  tally.errors++;
  tally.firstError ??= describe(error);
  if (into) into.errors++;
}

function drain(): void {
  const deadline = Date.now() + DRAIN_MS;
  const poll = (): void => {
    if (inflight === 0 || Date.now() >= deadline) report();
    else setTimeout(poll, 5);
  };
  poll();
}

function report(): void {
  const done: FromWorker = { kind: "done", report: { tallies, slices, settle, unfinished: inflight, last } };
  port.postMessage(done);
}

port.on("message", (message: ToWorker) => {
  if (message.kind === "stop") {
    stopped = true;
    return;
  }
  start = message.start;
  tick();
});
port.postMessage({ kind: "ready" } satisfies FromWorker);
