import { idOf } from "./types.ts";
import type { Body, Factor, Family, FamilyName, Framework, PerformanceTest, Suite, Test, TestId, ValidationTest } from "./types.ts";

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

/**
 * Every family in one value. Discovery is still what decides the list is complete.
 *
 * A base edge is checked here, where every test is in hand: its base has to be a measured row
 * and its factor a named one, and a chain has to end. A factor no test varies is refused too,
 * so the table cannot keep a reading nothing uses.
 */
export function suite(families: readonly Family[], factors: Readonly<Record<string, Factor>>): Suite {
  const byName: Record<FamilyName, Family> = {};
  const tests: Record<string, Test> = {};

  for (const f of families) {
    if (Object.hasOwn(byName, f.name)) throw new Error(`suite holds family ${f.name} twice`);
    byName[f.name] = f;
    for (const test of Object.values(f.tests)) tests[idOf(test.id)] = test;
  }

  const varied = new Set<string>();
  for (const [id, test] of Object.entries(tests)) {
    if (test.kind !== "performance") continue;
    const { base, varies } = test;
    if ((base === undefined) !== (varies === undefined)) {
      throw new Error(`${id} declares ${base === undefined ? "what varies without a base" : "a base without what varies"}`);
    }
    if (base === undefined || varies === undefined) continue;
    const against = tests[base];
    if (against === undefined) throw new Error(`${id} is read against ${base}, which is not a test`);
    if (against.kind !== "performance") throw new Error(`${id} is read against ${base}, which is never timed`);
    if (!Object.hasOwn(factors, varies)) throw new Error(`${id} varies ${varies}, which is not a factor`);
    varied.add(varies);
  }
  for (const id of Object.keys(tests)) {
    const seen = new Set<string>();
    for (let at: string | undefined = id; at !== undefined; ) {
      if (seen.has(at)) throw new Error(`the base chain from ${id} comes back to ${at}`);
      seen.add(at);
      const t: Test | undefined = tests[at];
      at = t?.kind === "performance" ? t.base : undefined;
    }
  }
  const unused = Object.keys(factors).filter((name) => !varied.has(name));
  if (unused.length > 0) throw new Error(`no test varies ${unused.join(", ")}`);

  return { families: byName, tests, factors };
}

/**
 * `scope` and `leaves` are never. A measured row is asked of every framework,
 * which is what makes the numbers comparable, and a measured row that left the
 * server changed would corrupt every row after it in the ladder.
 */
export function performanceTest(
  d: {
    id: TestId;
    path: string;
    about: string;
    request: Body;
    scope?: never;
    leaves?: never;
  } & ({ base: string; varies: string } | { base?: never; varies?: never }),
): PerformanceTest {
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
