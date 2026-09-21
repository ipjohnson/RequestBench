// What the generator is asked to offer one framework, and what it writes back. The orchestrator
// builds a load from the ladder and reads the result file, so both shapes are declared here,
// apart from the CLI that runs them.
import { z } from "zod";
import type { RunValues } from "@rb/tests/kit";
import { runValuesSchema } from "@rb/tests/models/parameters";

const ADDRESS = /^([^:]+):(\d+)$/;

/** The host and port a target names, or undefined when it does not name one. */
export function addressOf(target: string): { host: string; port: number } | undefined {
  const m = ADDRESS.exec(target);
  const port = Number(m?.[2]);
  return m !== null && port >= 1 && port <= 65535 ? { host: m[1]!, port } : undefined;
}

const seconds = z.number().positive();

/**
 * One rate, offered for a while. The settle runs first and is never recorded, so the framework,
 * the connections and the generator have adjusted to the rate before the recorded seconds
 * start. A phase with only a settle is a warmup.
 */
export const phaseSchema = z
  .strictObject({
    name: z.string().min(1),
    rps: z.number().positive(),
    settle: seconds.optional(),
    seconds: seconds.optional(),
    /** The share of the settle's instances that may be dropped. A settle that drops more ends the load. */
    abortDropFraction: z.number().min(0).max(1).optional(),
  })
  .refine((p) => p.settle !== undefined || p.seconds !== undefined, {
    message: "a phase needs settle, seconds or both",
  })
  .refine((p) => p.abortDropFraction === undefined || p.settle !== undefined, {
    message: "there is no settle to judge",
    path: ["abortDropFraction"],
  });

export const loadSchema = z.strictObject({
  target: z.string().refine((t) => addressOf(t) !== undefined, "expected host:port"),
  /** The declaration in frameworks/exceptions.ts whose statuses every answer is compared with. */
  framework: z.string(),
  /** The run's values, so every client in a run sends the same ones. Drawn by the generator when absent. */
  values: runValuesSchema.optional(),
  workers: z.number().int().positive().default(4),
  /** In flight across every thread, which is also the connection limit. */
  maxInflight: z.number().int().positive().default(1024),
  /** Test ids or family names. Absent means every performance test. */
  only: z.array(z.string().min(1)).min(1).optional(),
  /** Run in order, on the same threads and connections. */
  phases: z
    .array(phaseSchema)
    .min(1)
    .superRefine((phases, ctx) => {
      const seen = new Set<string>();
      for (const { name } of phases) {
        if (seen.has(name)) ctx.addIssue({ code: "custom", message: `two phases are named ${name}` });
        seen.add(name);
      }
    }),
});

/** A load as it is written. */
export type Load = z.input<typeof loadSchema>;

export type Phase = z.output<typeof phaseSchema>;

/** A load as it ran, with every default and the drawn values filled in. */
export type ResolvedLoad = Omit<z.output<typeof loadSchema>, "values"> & { readonly values: RunValues };

export interface Percentiles {
  readonly p50Us: number;
  readonly p90Us: number;
  readonly p99Us: number;
  readonly p999Us: number;
}

/** The settle's instances, summed over every test, because none of them is published as a latency. */
export interface SettleSummary {
  readonly seconds: number;
  readonly scheduled: number;
  readonly completed: number;
  readonly achievedRps: number;
  readonly dropped: number;
  readonly dropFraction: number;
  readonly errors: number;
  readonly mismatch: number;
  readonly p50Us: number;
  readonly p99Us: number;
  readonly firstMismatch?: string;
  readonly firstError?: string;
}

export interface TestSummary extends Percentiles {
  readonly id: string;
  readonly family: string;
  readonly count: number;
  readonly errors: number;
  readonly mismatch: number;
  readonly dropped: number;
  readonly unrecorded: number;
  readonly firstMismatch?: string;
  readonly firstError?: string;
  /** The test's histogram in the layout histogram.ts describes, as base64. */
  readonly histB64: string;
}

export interface RecordedSummary {
  readonly seconds: number;
  /** From the moment the first recorded instance was due to the last answer. */
  readonly elapsedSeconds: number;
  readonly achievedRps: number;
  readonly scheduled: number;
  readonly completed: number;
  readonly dropped: number;
  readonly errors: number;
  readonly mismatch: number;
  readonly unrecorded: number;
  readonly overall: Percentiles & { readonly count: number };
  readonly tests: readonly TestSummary[];
}

export type PhaseResult =
  | {
      readonly name: string;
      readonly rps: number;
      /** aborted: the settle dropped more than abortDropFraction, so nothing recorded or later ran. */
      readonly status: "done" | "aborted";
      readonly settle?: SettleSummary;
      readonly recorded?: RecordedSummary;
      /** Started in this phase and still in flight when the drain gave up. */
      readonly unfinished: number;
    }
  | {
      readonly name: string;
      readonly rps: number;
      /** An earlier phase aborted. */
      readonly status: "notRun";
    };

/** What --out holds. It is rewritten after every phase, so a load that stops partway keeps the phases it finished. */
export interface LoadResult {
  readonly load: ResolvedLoad;
  /** The performance tests offered. */
  readonly testsLive: number;
  readonly phases: readonly PhaseResult[];
}
