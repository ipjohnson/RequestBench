// Which performance tests a load offers, for the open loop in cli.ts and the closed loop in
// closed.ts alike.
import suite from "@rb/tests";
import { idOf } from "@rb/tests/kit";
import type { PerformanceTest } from "@rb/tests/kit";

/** A load that asks for what cannot be offered, which refuses it before anything is sent. */
export class UsageError extends Error {}

/**
 * The performance tests to offer, by id. `only` names a test by its id, or a whole family by its
 * name. A test the framework cannot answer on its host is left out whatever `only` says.
 */
export function select(only: readonly string[] | undefined, unsupported: Readonly<Record<string, string>> = {}): PerformanceTest[] {
  for (const id of Object.keys(unsupported)) {
    if (!Object.hasOwn(suite.tests, id)) throw new UsageError(`unsupported: ${id} is not a test`);
  }
  const measured = Object.values(suite.tests)
    .filter((test): test is PerformanceTest => test.kind === "performance" && !Object.hasOwn(unsupported, idOf(test.id)))
    .sort((a, b) => (idOf(a.id) < idOf(b.id) ? -1 : 1));
  if (measured.length === 0) throw new UsageError("unsupported: leaves no performance test to offer");
  if (only === undefined) return measured;

  const wanted = new Set<string>();
  for (const name of only) {
    if (Object.hasOwn(suite.tests, name)) {
      if (suite.tests[name]!.kind !== "performance") {
        throw new UsageError(`only: ${name} is a validation test, which is never timed`);
      }
      wanted.add(name);
    } else if (Object.hasOwn(suite.families, name)) {
      for (const test of measured) if (test.id.family === name) wanted.add(idOf(test.id));
    } else {
      throw new UsageError(`only: ${name} is neither a test nor a family`);
    }
  }
  const chosen = measured.filter((test) => wanted.has(idOf(test.id)));
  if (chosen.length === 0) throw new UsageError(`only: ${only.join(", ")} names no performance test`);
  return chosen;
}
