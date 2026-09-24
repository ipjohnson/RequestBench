// The measurement protocols: the rates every framework is offered, for how long, and when a rate
// is given up on. `measure --ladder <name>` picks one, and each workflow that measures names its
// own.
//
// Changing any number in a ladder changes what a run measured, so a change is a new version and
// the runs on either side of it are not read against each other. For the same reason, two ladders
// that differ in any number never share a version.
import type { ClosedPhase, Load } from "../traffic-generator/load.ts";

type Phase = Load["phases"][number];

/** A rung is recorded, so it has seconds. An open-loop rung also settles at its rate first. */
type Rung = Phase & { readonly settle: number; readonly seconds: number };
type ClosedRung = ClosedPhase & { readonly seconds: number };

export interface Ladder {
  /** The protocol on every host but lambda-emulator: rates, offered in an open loop. */
  readonly open: {
    readonly version: string;
    /** Thrown away. It is there so the rungs meet a framework that has warmed up. */
    readonly warmup: Phase;
    readonly rungs: readonly Rung[];
    /** How long a framework may take to answer /health before it counts as failed to boot. */
    readonly bootSeconds: number;
    /** Between one boot's stop and the next start, so a boot does not inherit a warm socket table. */
    readonly cooldownMs: number;
  };
  /**
   * lambda-emulator's protocol. A function answers one event at a time and asks for the next, so it
   * is offered a closed loop rather than rates: every event goes out the moment the runtime asks. A
   * Lambda function's first event is live traffic, where a container can be warmed before it takes
   * any, so nothing warms the function: one phase records from the first event it answers. The
   * requests that learn each answer are sent in the gate's boot.
   */
  readonly closed: {
    readonly version: string;
    readonly rungs: readonly ClosedRung[];
    /** How long a function's runtime may take to ask for its first event before it counts as failed to boot. */
    readonly bootSeconds: number;
    readonly cooldownMs: number;
  };
}

export const LADDERS = {
  /**
   * The ladder measure.yml runs on GitHub-hosted runners. Upstream's ladder-v3-short with 1,000 rps
   * as the lowest rung, and one warmup for every framework, because a run spanning languages
   * already gave every framework the longest one.
   */
  ci: {
    open: {
      version: "ladder-v2",
      warmup: { name: "warmup", rps: 1000, settle: 30 },
      rungs: [
        { name: "regular", rps: 1000, settle: 15, seconds: 60, abortDropFraction: 0.05 },
        { name: "raised", rps: 2500, settle: 15, seconds: 60, abortDropFraction: 0.05 },
        { name: "peak", rps: 5000, settle: 15, seconds: 60, abortDropFraction: 0.05 },
      ],
      bootSeconds: 90,
      cooldownMs: 500,
    },
    closed: {
      version: "closed-v2",
      rungs: [{ name: "closed", seconds: 120 }],
      bootSeconds: 90,
      cooldownMs: 500,
    },
  },
} as const satisfies Record<string, Ladder>;

export type LadderId = keyof typeof LADDERS;

export const isLadderId = (id: string): id is LadderId => Object.hasOwn(LADDERS, id);

/**
 * The phases a framework is offered. `seconds` shortens every rung for a smoke run, which is
 * never recorded, and scales the settles and the warmup down with it the way upstream did.
 */
export function phasesOf(ladder: Ladder, seconds?: number): Phase[] {
  const { warmup, rungs } = ladder.open;
  if (seconds === undefined) return [warmup, ...rungs];
  return [
    { ...warmup, settle: Math.max(5, Math.floor(seconds / 2)) },
    ...rungs.map((r) => ({ ...r, seconds, settle: Math.min(r.settle, Math.max(1, Math.floor(seconds / 4))) })),
  ];
}

/** The closed-loop phases, with `seconds` shortening the recording for a smoke run. */
export function closedPhasesOf(ladder: Ladder, seconds?: number): ClosedPhase[] {
  return ladder.closed.rungs.map((r) => ({ ...r, seconds: seconds ?? r.seconds }));
}
