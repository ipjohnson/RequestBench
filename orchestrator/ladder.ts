// The measurement protocol: the rates every framework is offered, for how long, and when a rate
// is given up on. Upstream's ladder-v3-short, with one warmup for every framework, because a
// run spanning languages already gave every framework the longest one.
//
// Changing any number here changes what a run measured, so a change is a new version and the
// runs on either side of it are not read against each other.
import type { Load } from "../traffic-generator/load.ts";

type Phase = Load["phases"][number];

export const LADDER = {
  version: "ladder-v1",
  /** Thrown away. It is there so the rungs meet a framework that has warmed up. */
  warmup: { name: "warmup", rps: 1000, settle: 30 },
  rungs: [
    { name: "regular", rps: 500, settle: 15, seconds: 60, abortDropFraction: 0.05 },
    { name: "raised", rps: 2500, settle: 15, seconds: 60, abortDropFraction: 0.05 },
    { name: "peak", rps: 5000, settle: 15, seconds: 60, abortDropFraction: 0.05 },
  ],
  /** How long a framework may take to answer /health before it counts as failed to boot. */
  bootSeconds: 90,
  /** Between one boot's stop and the next start, so a boot does not inherit a warm socket table. */
  cooldownMs: 500,
} as const satisfies {
  version: string;
  warmup: Phase;
  rungs: readonly Phase[];
  bootSeconds: number;
  cooldownMs: number;
};

/**
 * The phases a framework is offered. `seconds` shortens every rung for a smoke run, which is
 * never recorded, and scales the settles and the warmup down with it the way upstream did.
 */
export function phasesOf(seconds?: number): Phase[] {
  if (seconds === undefined) return [LADDER.warmup, ...LADDER.rungs];
  return [
    { ...LADDER.warmup, settle: Math.max(5, Math.floor(seconds / 2)) },
    ...LADDER.rungs.map((r) => ({ ...r, seconds, settle: Math.min(r.settle, Math.max(1, Math.floor(seconds / 4))) })),
  ];
}
