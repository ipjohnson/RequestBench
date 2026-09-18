#!/usr/bin/env node
// Gate a running target. Ported from harness/conform.py, including its output format, so
// the two can be run against one target and diffed while both exist.
//
//   rb-client 127.0.0.1:8080 --target node:fastify [--reference ref.json] [--compare ref.json]
//   rb-client 127.0.0.1:8080 --target node:fastify --mode expect
//   rb-client 127.0.0.1:8080 --target node:fastify --values '{"one":4821}'
//
// Two authorities, one replay. The gate checks a target against another target measured in
// the same run; expect checks it against spec/expected.json and never against another target.
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { gate, dictRepr, type EndpointResult } from "./gate.js";
import { check, type EndpointVerdict } from "./expectation.js";
import { loadExpected, loadPlan, type Plan } from "./spec.js";
import type { Comparable } from "./compare.js";
import type { Encoding } from "./checks.js";
import { draw, parseValues, type Values } from "./values.js";

const pad = (s: string | number, w: number): string => String(s).padEnd(w);

class UsageError extends Error {}

/** argparse's choices=, which a cast to the union type only pretends to do. */
function asEncoding(v: string): Encoding {
  if (v !== "http" && v !== "lambda") {
    throw new UsageError(`argument --encoding: invalid choice: '${v}' (choose from 'http', 'lambda')`);
  }
  return v;
}

/** argparse's choices=, for the authority the replay is judged by. */
function asMode(v: string): "gate" | "expect" {
  if (v !== "gate" && v !== "expect") {
    throw new UsageError(`argument --mode: invalid choice: '${v}' (choose from 'gate', 'expect')`);
  }
  return v;
}

/** The values a run drew, checked against what the plan declares. */
function asValues(v: string, plan: Plan): Values {
  try {
    return parseValues(v, plan.run_values ?? {});
  } catch (e) {
    throw new UsageError(`argument --values: ${(e as Error).message}`);
  }
}

/** argparse's type=int. NaN would otherwise read as "every instance". */
function asCount(v: string): number {
  if (!/^\d+$/.test(v)) throw new UsageError(`argument --instances: invalid int value: '${v}'`);
  return Number(v);
}

function summarise(r: EndpointResult): string {
  const status = r.ok ? (r.seen.keys().next().value ?? "") : dictRepr(r.seen);
  const note = r.drift ? `  <- ${r.drift}` : "";
  return `  ${r.ok ? "ok  " : "FAIL"} ${pad(r.id, 18)} ${pad(r.method, 6)} ${pad(r.instances, 3)} instances  ${status}${note}`;
}

function write(path: string, text: string): number {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  return statSync(path).size;
}

/** One line per endpoint, then the distinct complaints under each that failed. */
function report(v: EndpointVerdict): string {
  const head = `  ${v.ok ? "ok  " : "FAIL"} ${pad(v.id, 18)} ${v.total} request(s)`;
  if (v.ok) return head;
  // An endpoint has up to 512 distinct requests and they usually fail identically, so the
  // count goes on the header line and each distinct complaint gets one line under it.
  return [`${head}  ${v.wrong} wrong`, ...v.problems.map((p) => `         ${p}`)].join("\n");
}

async function expect(
  plan: Plan, hostport: string, target: string,
  opts: { instances: number; encoding: Encoding; quiet: boolean; values: Values },
): Promise<number> {
  const expected = loadExpected(plan);
  const result = await check(plan, expected, hostport, target, {
    instances: opts.instances,
    encoding: opts.encoding,
    values: opts.values,
    onEndpoint: (v) => { if (!opts.quiet || !v.ok) console.log(report(v)); },
  });
  const failed = result.endpoints.filter((e) => !e.ok);
  console.log(`\n${result.endpoints.length - failed.length}/${result.endpoints.length} `
    + `endpoints answer spec/expected.json  (${result.sent} requests sent)`);
  return failed.length > 0 ? 1 : 0;
}

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      target: { type: "string" },
      mode: { type: "string", default: "gate" },
      instances: { type: "string", default: "0" },
      reference: { type: "string" },
      compare: { type: "string" },
      quiet: { type: "boolean", default: false },
      exemplars: { type: "string" },
      encoding: { type: "string", default: "http" },
      "skip-headers": { type: "boolean", default: false },
      values: { type: "string" },
    },
  });
  const hostport = positionals[0];
  if (!hostport) {
    console.error("usage: rb-client <host:port> --target <language:framework> "
      + "[--reference FILE] [--compare FILE]");
    return 2;
  }
  // Not optional, and not defaulted. An error endpoint is judged against the contract the
  // framework declared for itself, so a gate that does not know which framework it is
  // talking to cannot check the thing it exists to check.
  const target = values.target;
  if (!target) throw new UsageError("the following arguments are required: --target");

  const plan = loadPlan();
  // A run passes the values it drew, so every target in it is sent the same ones. Anything
  // else draws its own, which is all a target checked on its own needs.
  const drawn = values.values === undefined
    ? draw(plan.run_values ?? {})
    : asValues(values.values, plan);
  if (asMode(values.mode) === "expect") {
    return await expect(plan, hostport, target, {
      instances: asCount(values.instances),
      encoding: asEncoding(values.encoding),
      quiet: values.quiet,
      values: drawn,
    });
  }
  const reference = values.compare
    ? (JSON.parse(readFileSync(values.compare, "utf8")) as Record<string, Comparable>)
    : null;

  const result = await gate(plan, hostport, target, {
    instances: asCount(values.instances),
    encoding: asEncoding(values.encoding),
    skipHeaders: values["skip-headers"],
    reference,
    values: drawn,
    onEndpoint: (r) => { if (!values.quiet) console.log(summarise(r)); },
  });

  const failures = result.endpoints.filter((e) => !e.ok);
  console.log(`\n${result.endpoints.length - failures.length}/${result.endpoints.length} endpoints conform  (${result.sent} requests sent)`);
  for (const f of failures) console.log(`  FAIL ${pad(f.id, 18)} ${f.why}`);

  if (result.drift.length > 0) {
    // The first difference goes on the header line, because run.py reports the summary and
    // the line after it. A count with the detail on the next line down told the reader a
    // response differed without saying how.
    const [first, ...rest] = result.drift;
    console.log(`  ${result.drift.length} response(s) differ from the reference: ${first?.[0]} ${first?.[1]}`);
    for (const [eid, d] of rest.slice(0, 11)) console.log(`    ${pad(eid, 18)} ${d}`);
  }
  // A reference from a target that does not serve the whole spec can only check the part it
  // does serve. Saying so keeps a thin comparison from reading like a clean pass.
  if (reference !== null && result.drift.length === 0) {
    const total = Object.keys(result.responses).length;
    const tail = result.compared === total ? "" : "; the reference does not cover the rest";
    console.log(`  ${result.compared}/${total} responses compared against the reference${tail}`);
  }
  if (result.headerProblems.length > 0) {
    console.log(`  ${result.headerProblems.length} response header problem(s):`);
    for (const [eid, msg] of result.headerProblems.slice(0, 12)) console.log(`    ${pad(eid, 18)} ${msg}`);
  }
  if (values.exemplars) {
    const m = result.meta as Record<string, string | undefined>;
    const size = write(values.exemplars, JSON.stringify({
      framework: m["framework"] ?? "", version: m["version"] ?? "",
      runtime: m["runtime"] ?? "", adapter: m["adapter"] ?? "",
      blend: plan.version, endpoints: result.exemplars,
    }, null, 1));
    console.log(`  exemplars -> ${values.exemplars} (${result.exemplars.length} endpoints, ${(size / 1024).toFixed(1)} KB)`);
  }
  if (values.reference) {
    const sorted = Object.fromEntries(Object.entries(result.responses).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
    const size = write(values.reference, JSON.stringify(sorted));
    console.log(`  reference -> ${values.reference} (${Object.keys(result.responses).length} requests, ${(size / 1024).toFixed(1)} KB)`);
  }
  return failures.length > 0 || result.drift.length > 0 || result.headerProblems.length > 0 ? 1 : 0;
}

try {
  process.exitCode = await main();
} catch (e) {
  if (!(e instanceof UsageError)) throw e;
  console.error(`rb-client: error: ${e.message}`);
  process.exitCode = 2;
}
