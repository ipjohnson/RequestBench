import { idOf } from "./types.ts";
import type { Body, Family, FamilyName, Framework, PerformanceTest, Suite, Test, TestId, ValidationTest } from "./types.ts";

/**
 * A family and the tests in it. The tests are passed as a list rather than a map
 * so that nothing names a row twice: the key is `id.name`, taken from the test.
 *
 * A test declaring a different family throws here rather than at load, because
 * this is the one file that holds both the family and the row claiming it.
 */
export function family(d: {
  name: FamilyName;
  about: string;
  comparable: string;
  tests: readonly Test[];
}): Family {
  const tests: Record<string, Test> = {};

  for (const test of d.tests) {
    const id = idOf(test.id);
    if (test.id.family !== d.name) throw new Error(`family ${d.name} holds ${id}, which declares ${test.id.family}`);
    if (Object.hasOwn(tests, test.id.name)) throw new Error(`family ${d.name} holds ${id} twice`);
    tests[test.id.name] = test;
  }

  return { name: d.name, about: d.about, comparable: d.comparable, tests };
}

/** Every family in one value. Discovery is still what decides the list is complete. */
export function suite(families: readonly Family[]): Suite {
  const byName: Record<FamilyName, Family> = {};
  const tests: Record<string, Test> = {};

  for (const f of families) {
    if (Object.hasOwn(byName, f.name)) throw new Error(`suite holds family ${f.name} twice`);
    byName[f.name] = f;
    for (const test of Object.values(f.tests)) tests[idOf(test.id)] = test;
  }

  return { families: byName, tests };
}

/**
 * `scope` and `leaves` are never. A measured row is asked of every framework,
 * which is what makes the numbers comparable, and a measured row that left the
 * server changed would corrupt every row after it in the ladder.
 */
export function performanceTest(d: {
  id: TestId;
  path: string;
  about: string;
  request: Body;
  scope?: never;
  leaves?: never;
}): PerformanceTest {
  const { scope: _s, leaves: _l, ...rest } = d;
  return { kind: "performance", ...rest };
}

export function validationTest(d: {
  id: TestId;
  path?: string;
  about: string;
  request: Body;
  scope?: (f: Framework) => boolean;
  leaves?: string;
}): ValidationTest {
  return { kind: "validation", ...d };
}
