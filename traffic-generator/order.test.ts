// The order the load sends the performance tests in, built from the corpus's hefts.
//
//   node --experimental-strip-types --test traffic-generator/order.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import suite from "@rb/tests";
import { idOf, performanceTest } from "@rb/tests/kit";
import type { Heft, PerformanceTest } from "@rb/tests/kit";
import { CALLS, cycle, orderOf } from "./order.ts";
import { select } from "./select.ts";

const corpus = Object.values(suite.tests).filter((t): t is PerformanceTest => t.kind === "performance");

/** A test that is only a name and a heft, which is all an order reads. */
const row = (name: string, heft: Heft): PerformanceTest =>
  performanceTest({ id: { family: "f", name }, path: `/${name}`, heft, about: name, request: (c) => c.get(`/${name}`).ok() });

test("every test is sent its heft's calls in each cycle", () => {
  const order = cycle(corpus);
  const counts = new Map<string, number>();
  for (const id of order) counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const t of corpus) assert.equal(counts.get(idOf(t.id)), CALLS[t.heft], idOf(t.id));
  assert.equal(order.length, corpus.reduce((n, t) => n + CALLS[t.heft], 0));
});

test("a heft hands its slots to its tests in alphabetical turn", () => {
  const order = cycle(corpus);
  for (const heft of [1, 2, 3, 4, 5] as const) {
    const ids = corpus
      .filter((t) => t.heft === heft)
      .map((t) => idOf(t.id))
      .sort();
    const slots = order.filter((id) => ids.includes(id));
    assert.deepEqual(
      slots,
      slots.map((_, i) => ids[i % ids.length]),
      `heft ${heft}`,
    );
  }
});

test("smooth weighted round-robin spreads the hefts, and the heavier goes first where they are level", () => {
  // Heft 1 weighs two tests times 10 calls, heft 4 one test times 2 and heft 5 two tests times 1.
  // All three stand level at the fourth slot, and heft 5 takes it.
  const order = cycle([row("b", 1), row("a", 1), row("c", 4), row("e", 5), row("d", 5)]);
  assert.equal(order.map((id) => id.replace(/^f\./, "")).join(""), "abadbabcabababaebabcabab");
});

test("a load that offers fewer tests keeps the others in the corpus's order", () => {
  const unsupported = { "json.medium": "not here", "compressed.gzip_large": "not here" };
  const offered = select(undefined, unsupported);
  const kept = cycle(corpus).filter((id) => !Object.hasOwn(unsupported, id));
  assert.deepEqual(
    orderOf(offered).map((i) => idOf(offered[i]!.id)),
    kept,
  );
});
