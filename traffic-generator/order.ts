// The order the load sends the performance tests in, for the open loop in cli.ts and the closed
// loop in closed.ts alike. Each heft has a number of calls in every cycle, so a heavy test goes
// out less often than a light one. The cycle is built once over the whole corpus and repeated for
// as long as a phase runs, so every run and every framework is sent the same sequence. A load
// that offers fewer tests, through `only` or a host's unsupported list, loses their slots and
// keeps the rest in the same order.
import suite from "@rb/tests";
import { idOf } from "@rb/tests/kit";
import type { Heft, PerformanceTest } from "@rb/tests/kit";

/** How many times one test of each heft is sent in a cycle. */
export const CALLS: Readonly<Record<Heft, number>> = { 1: 10, 2: 6, 3: 3, 4: 2, 5: 1 };

/** Heaviest first, which is where a tie between two hefts goes. */
const HEFTS: readonly Heft[] = [5, 4, 3, 2, 1];

/**
 * One cycle of these tests, as test ids, with a slot for every call. Smooth weighted round-robin,
 * the way nginx spreads requests over weighted upstreams, picks the heft that fills each slot,
 * each heft weighing its tests times its calls. A heft hands its slots to its tests in
 * alphabetical turn, so each test gets exactly its calls and they are spread through the cycle.
 */
export function cycle(tests: readonly PerformanceTest[]): string[] {
  const hefts = HEFTS.map((heft) => {
    const ids = tests
      .filter((test) => test.heft === heft)
      .map((test) => idOf(test.id))
      .sort();
    return { ids, weight: ids.length * CALLS[heft], current: 0, handed: 0 };
  }).filter((h) => h.weight > 0);
  const total = hefts.reduce((n, h) => n + h.weight, 0);
  const out: string[] = [];
  for (let slot = 0; slot < total; slot++) {
    for (const h of hefts) h.current += h.weight;
    const next = hefts.reduce((best, h) => (h.current > best.current ? h : best));
    next.current -= total;
    out.push(next.ids[next.handed++ % next.ids.length]!);
  }
  return out;
}

/**
 * A load's order: the corpus's cycle without the tests the load does not offer, each slot given
 * as its test's place in `offered`.
 */
export function orderOf(offered: readonly PerformanceTest[]): number[] {
  const at = new Map(offered.map((test, i) => [idOf(test.id), i]));
  const corpus = Object.values(suite.tests).filter((test): test is PerformanceTest => test.kind === "performance");
  return cycle(corpus).flatMap((id) => (at.has(id) ? [at.get(id)!] : []));
}
