// What a load counts, per test and per slice of the schedule, in one thread or merged across
// all of them.
import { BUCKETS, addInto } from "./histogram.ts";

export interface Tally {
  /** Instances timed into `hist`. A mismatched answer is timed as well as counted in `mismatch`. */
  count: number;
  errors: number;
  mismatch: number;
  /** Never sent, because the in-flight limit was reached at their scheduled moment. */
  dropped: number;
  /** Finished without being timed, because they waited on a `once` value being made. */
  unrecorded: number;
  readonly hist: Uint32Array;
  firstError: string | undefined;
  firstMismatch: string | undefined;
}

/** Every instance scheduled inside one slice, whichever test it picked. */
export interface Slice {
  errors: number;
  mismatch: number;
  dropped: number;
  readonly hist: Uint32Array;
}

export const newTally = (): Tally => ({
  count: 0,
  errors: 0,
  mismatch: 0,
  dropped: 0,
  unrecorded: 0,
  hist: new Uint32Array(BUCKETS),
  firstError: undefined,
  firstMismatch: undefined,
});

export const newSlice = (): Slice => ({ errors: 0, mismatch: 0, dropped: 0, hist: new Uint32Array(BUCKETS) });

export function mergeTally(into: Tally, from: Tally): void {
  into.count += from.count;
  into.errors += from.errors;
  into.mismatch += from.mismatch;
  into.dropped += from.dropped;
  into.unrecorded += from.unrecorded;
  addInto(into.hist, from.hist);
  into.firstError ??= from.firstError;
  into.firstMismatch ??= from.firstMismatch;
}

export function mergeSlice(into: Slice, from: Slice): void {
  into.errors += from.errors;
  into.mismatch += from.mismatch;
  into.dropped += from.dropped;
  addInto(into.hist, from.hist);
}
