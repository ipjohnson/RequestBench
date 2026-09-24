// What a phase counts, per test, as the Rust program reports it, with its histograms decoded.
import { BUCKETS } from "./histogram.ts";
import type { WireTally } from "./pipe.ts";

export interface Tally {
  /** Instances timed into `hist`. A mismatched answer is timed as well as counted in `mismatch`. */
  readonly count: number;
  readonly errors: number;
  readonly mismatch: number;
  /** Never sent, because the in-flight limit was reached at their scheduled moment. */
  readonly dropped: number;
  readonly hist: Uint32Array;
  /** The recorded instances in each window of the phase, in order, which `hist` also counts. */
  readonly windows: readonly Uint32Array[];
  readonly firstError: string | undefined;
  readonly firstMismatch: string | undefined;
}

function histOf(b64: string): Uint32Array {
  const bytes = Buffer.from(b64, "base64");
  const hist = new Uint32Array(BUCKETS);
  for (let i = 0; i < BUCKETS; i++) hist[i] = bytes.readUInt32LE(i * 4);
  return hist;
}

export function tallyOf(t: WireTally): Tally {
  return {
    count: t.count,
    errors: t.errors,
    mismatch: t.mismatch,
    dropped: t.dropped,
    hist: histOf(t.hist),
    windows: t.windows.map(histOf),
    firstError: t.firstError ?? undefined,
    firstMismatch: t.firstMismatch ?? undefined,
  };
}
