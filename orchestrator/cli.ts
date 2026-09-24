// The orchestrator's command line: `npm run rb -- <command>`. USAGE below lists the commands.
//
// Every command reads the repository it runs in. A framework is named language:name, as in
// frameworks/exceptions.ts, and `tests` names the tests bundle.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, type ParseArgsOptionsConfig } from "node:util";

import suite from "@rb/tests";
import exceptions from "../frameworks/exceptions.ts";
import { frameworkBundle, frameworkProblems, testsBundle, TESTS_ID, type Bundle, type FrameworkKey } from "./bundle.ts";
import * as container from "./container.ts";
import { exemplarFile, FIXED_VALUES, gate, type GateResult } from "./gate.ts";
import { dirty, git, pushed, repoSlug, resolveCommit, tracked, unstaged } from "./git.ts";
import { HOSTS, isHostId, type HostId } from "./hosts.ts";
import { LADDER, phasesOf } from "./ladder.ts";
import { http1, type Exchange } from "./live.ts";
import { cpuList, machineState } from "./machine.ts";
import { loadRepo, type LoadedFramework } from "./manifest.ts";
import { measure, type Driver, type RunFile } from "./measure.ts";
import { corpusEndpoints, frameworkView, testsView } from "./siteview.ts";
import { summarize } from "./summarize.ts";
import { covered, failing, located } from "./snippets.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const USAGE = [
  "usage: npm run rb -- <command> [options]",
  "",
  "  list [--host <id>] [--json]",
  "      every framework with an rb.json, and the hosts it implements",
  "  check",
  "      every rb.json, every framework's bundle, and where each framework answers each test",
  "  bundle [<framework>|tests]... [--all] [--host <id>] [--at <commit>] [--summary]",
  "      the files, roles and hashes a run records, from the working tree or at a commit",
  "  snippets [<framework>]... [--at <commit>] [--summary] [--check]",
  "      where each framework answers each test",
  "  siteview [--at <commit> | --worktree] [--host <id>] [--out <file>]",
  "      everything the site shows about the code and the tests behind a run, at a commit or in the working tree",
  "  validate <framework> [--host <id>] [--commit <rev>] [--exemplars]",
  "  validate --at <host:port> --framework <framework> [--host <id>] [--exemplars]",
  "      the whole corpus against a framework, in its container or started by hand; --exemplars",
  "      writes results/exemplars/<language>-<name>@<host>.json from what it answered",
  "  measure [<framework>]... [--host <id>] [--seconds <n>] [--only <test|family>,...]",
  "      gate and measure every framework on one host, and write results/runs/<run>.json",
  "  summarize <run file> [--out <file>]",
  "      the run as the site reads it: percentiles and histograms per test, family and rung",
  "  suite <framework>...",
  "      each framework's own tests, as rb.json declares them",
  "  client <framework>...",
  "      rewrite each framework's OpenAPI document and client, as rb.json declares, and fail if Client/ changed",
  "  upgrade <framework>...",
  "      move each framework's pins, as rb.json declares, and show what moved",
].join("\n");

export class UsageError extends Error {}

function parse<const O extends ParseArgsOptionsConfig>(args: string[], options: O) {
  try {
    return parseArgs({ args, options, allowPositionals: true });
  } catch (error) {
    throw new UsageError((error as Error).message);
  }
}

const keyOf = (id: string): FrameworkKey => {
  const m = /^([a-z0-9-]+):([a-z0-9.-]+)$/.exec(id);
  if (m === null) throw new UsageError(`${id} is not a framework: write language:name`);
  return { language: m[1]!, name: m[2]! };
};

const hostOf = (id: string | undefined): HostId => {
  const host = id ?? "container-h1";
  if (!isHostId(host)) throw new UsageError(`${host} is not a host, only ${Object.keys(HOSTS).join(", ")} are`);
  return host;
};

/** Refuses a host whose protocol nothing here speaks yet. The gate and the load reach a framework only over HTTP/1.1 today. */
function spoken(host: HostId): void {
  const { protocol } = HOSTS[host];
  if (protocol !== "http/1.1") throw new UsageError(`${host} cannot be reached yet: nothing here speaks ${protocol}`);
}

/** The frameworks whose rb.json loads, narrowed to the ones named. A name that does not load is an error. */
function frameworks(named: readonly string[]): LoadedFramework[] {
  const { frameworks: loaded, problems } = loadRepo(ROOT);
  if (named.length === 0) return loaded;
  return named.map((id) => {
    keyOf(id);
    const f = loaded.find((x) => x.id === id);
    if (f === undefined) {
      const why = problems.filter((p) => p.includes(id) || p.includes(`frameworks/${id.replace(":", "/")}/`));
      throw new UsageError(`${id} has no rb.json that loads${why.length > 0 ? `:\n  ${why.join("\n  ")}` : ""}`);
    }
    return f;
  });
}

const atOf = (at: string | undefined) => (at === undefined ? undefined : resolveCommit(ROOT, at));

// ---- list, check, bundle ---------------------------------------------------------------

function list(args: string[]): number {
  const { values } = parse(args, { host: { type: "string" }, json: { type: "boolean" } });
  const host = values.host === undefined ? undefined : hostOf(values.host);
  const rows = frameworks([])
    .filter((f) => host === undefined || Object.hasOwn(f.rb.hosts, host))
    .map((f) => ({ id: f.id, language: f.language, name: f.name, hosts: Object.keys(f.rb.hosts) }));
  if (values.json) console.log(JSON.stringify(rows));
  else for (const r of rows) console.log(`${r.id.padEnd(24)} ${r.hosts.join(", ")}`);
  return 0;
}

async function check(args: string[]): Promise<number> {
  parse(args, {});
  const { frameworks: loaded, problems } = loadRepo(ROOT);
  const { endpoints, required } = await corpusEndpoints(suite);
  for (const f of loaded) {
    const hosts = Object.keys(f.rb.hosts) as HostId[];
    for (const host of hosts) problems.push(...frameworkProblems(frameworkBundle(ROOT, f, host)).map((p) => `${p} on ${host}`));
    const view = frameworkView(ROOT, f, undefined, endpoints, required, hosts[0]!);
    problems.push(...view.problems, ...failing(f.id, view.failures));
  }
  for (const p of problems) console.log(p);
  console.log(`${loaded.length} framework(s) loaded, ${problems.length} problem(s)`);
  return problems.length === 0 ? 0 : 1;
}

function bundle(args: string[]): number {
  const { values, positionals } = parse(args, {
    all: { type: "boolean" },
    host: { type: "string" },
    at: { type: "string" },
    summary: { type: "boolean" },
  });
  const host = hostOf(values.host);
  const every = () => [...frameworks([]).map((f) => f.id), TESTS_ID];
  const ids = values.all ? every() : positionals;
  if (ids.length === 0) throw new UsageError("name a framework or tests, or pass --all");
  // Resolved once, so every bundle names the same commit even if HEAD moves mid-run.
  const at = atOf(values.at);
  const bundles: Bundle[] = ids.map((id) => (id === TESTS_ID ? testsBundle(ROOT, at) : frameworkBundle(ROOT, keyOf(id), host, at)));
  if (values.summary) {
    for (const b of bundles) {
      console.log(`${b.id.padEnd(24)} code ${b.codeHash.slice(7, 19)}  bundle ${b.bundleHash.slice(7, 19)}  ${String(b.files.length).padStart(3)} files`);
    }
  } else {
    console.log(JSON.stringify(bundles.length === 1 ? bundles[0] : bundles, null, 2));
  }
  return 0;
}

// ---- snippets, siteview ----------------------------------------------------------------

async function snippets(args: string[]): Promise<number> {
  const { values, positionals } = parse(args, {
    at: { type: "string" },
    summary: { type: "boolean" },
    check: { type: "boolean" },
  });
  const chosen = frameworks(positionals);
  const at = atOf(values.at);
  const { endpoints, required } = await corpusEndpoints(suite);
  const families = [...new Set(endpoints.map((e) => e.family))];
  let bad = 0;

  for (const f of chosen) {
    const view = frameworkView(ROOT, f, at, endpoints, required, Object.keys(f.rb.hosts)[0] as HostId);
    const problems = [...view.problems, ...failing(f.id, view.failures)];
    bad += problems.length;
    const records = Object.values(view.snippets);
    if (values.summary || values.check) {
      const answered = records.filter((r) => required.has(r.endpoint));
      const how = (h: "derived" | "marker") => answered.filter((r) => r.handler?.how === h).length;
      const itself = answered.filter((r) => r.handler === null).length;
      const { wired, builtin } = covered(families, view.mechanisms);
      console.log(
        `${f.id.padEnd(22)} ${answered.length}/${required.size} tests (${how("derived")} derived, ${how("marker")} marked, ${itself} answered by the framework)  ` +
          `${wired + builtin}/${families.length} families (${wired} wired, ${builtin} built in)` +
          (problems.length > 0 ? `  ${problems.length} PROBLEM(S)` : ""),
      );
    } else {
      console.log(JSON.stringify(records.map(located), null, 2));
    }
    for (const p of problems) console.log(`  ${p}`);
  }
  return values.check && bad > 0 ? 1 : 0;
}

async function siteview(args: string[]): Promise<number> {
  const { values } = parse(args, { at: { type: "string" }, worktree: { type: "boolean" }, host: { type: "string" }, out: { type: "string" } });
  const host = hostOf(values.host);
  if (values.worktree && values.at !== undefined) throw new UsageError("--at reads a commit and --worktree the working tree, so give one");
  // A run made from a changed working tree measured files no commit holds, and only the
  // working tree can still show them. The site checks it against the bundle the run recorded.
  const at = values.worktree ? undefined : resolveCommit(ROOT, values.at ?? "HEAD");
  const { endpoints, required, recordings } = await corpusEndpoints(suite);
  const views: Record<string, unknown> = {};
  const listed = at === undefined ? tracked(ROOT, "frameworks/") : git(ROOT, ["ls-tree", "-r", "--name-only", at, "--", "frameworks/"]).split("\n");
  for (const path of listed) {
    const m = /^frameworks\/([^/_][^/]*)\/([^/_][^/]*)\/rb\.json$/.exec(path);
    if (m === null) continue;
    const key = { language: m[1]!, name: m[2]! };
    try {
      views[`${key.language}:${key.name}`] = frameworkView(ROOT, key, at, endpoints, required, host);
    } catch (error) {
      // History that cannot answer is said, never guessed at: the page says the source is unavailable.
      views[`${key.language}:${key.name}`] = null;
      console.error(`${key.language}:${key.name}: ${(error as Error).message}`);
    }
  }
  const doc = {
    commit: at ?? resolveCommit(ROOT),
    worktree: at === undefined,
    repo: repoSlug(ROOT),
    frameworks: views,
    tests: testsView(ROOT, at, suite, recordings),
  };
  const text = JSON.stringify(doc);
  if (values.out === undefined) console.log(text);
  else {
    mkdirSync(dirname(values.out), { recursive: true });
    writeFileSync(values.out, text);
    console.error(`siteview ${at === undefined ? "of the working tree" : `at ${at.slice(0, 12)}`} -> ${values.out}`);
  }
  return 0;
}

// ---- validate, measure -----------------------------------------------------------------

/** Whether anything is still listening, asked once a call has failed to get an answer. */
const listening = (host: string, port: number): Promise<boolean> =>
  new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (up: boolean) => {
      socket.destroy();
      resolve(up);
    };
    socket.setTimeout(1000, () => done(false));
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
  });

function report(result: GateResult): void {
  const counts: Record<string, number> = {};
  for (const [id, o] of Object.entries(result.outcomes)) {
    counts[o.status] = (counts[o.status] ?? 0) + 1;
    if (o.status === "failed") {
      console.log(`FAIL ${id}`);
      for (const f of o.failures) console.log(`  ${f}`);
    } else if (o.status === "skipped") console.log(`skip ${id}: ${o.reason}`);
    else if (o.status === "unsupported") console.log(`unsupported ${id}: ${o.reason}`);
    else if (o.status === "unrun") console.log(`unrun ${id}`);
  }
  const order = ["passed", "failed", "skipped", "unsupported", "notAsked", "unrun"];
  const line = order.filter((k) => counts[k]).map((k) => `${counts[k]} ${k === "notAsked" ? "not asked" : k}`).join(", ");
  console.log(`${line}; ${result.measurable ? "measurable" : "not measurable"}`);
}

function writeExemplars(id: string, host: HostId, exchanges: ReadonlyMap<string, Exchange>): void {
  const key = keyOf(id);
  const file = join(ROOT, "results", "exemplars", `${key.language}-${key.name}@${host}.json`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(exemplarFile(id, host, exchanges), null, 2)}\n`);
  console.log(`exemplars -> ${file}`);
}

async function gateAt(
  id: string,
  host: HostId,
  address: { host: string; port: number },
  f: LoadedFramework | undefined,
  alive: () => Promise<boolean>,
) {
  const sink: { current: Exchange[] } = { current: [] };
  const live = http1(address, (e) => sink.current.push(e));
  try {
    return await gate({
      suite,
      transport: live.transport,
      exceptions: exceptions[id as keyof typeof exceptions],
      declared: f?.declared,
      skips: f?.rb.skips,
      unsupported: f?.rb.hosts[host]?.unsupported,
      run: FIXED_VALUES,
      alive,
      exchanges: sink,
    });
  } finally {
    await live.close();
  }
}

async function validate(args: string[]): Promise<number> {
  const { values, positionals } = parse(args, {
    at: { type: "string" },
    framework: { type: "string" },
    host: { type: "string" },
    commit: { type: "string" },
    exemplars: { type: "boolean" },
  });
  const host = hostOf(values.host);
  spoken(host);

  if (values.at !== undefined) {
    const m = /^([^:]+):(\d+)$/.exec(values.at);
    if (m === null) throw new UsageError(`--at is host:port, not ${values.at}`);
    const id = values.framework;
    if (id === undefined) throw new UsageError("--framework is required with --at, to read its error bodies");
    if (!Object.hasOwn(exceptions, id)) throw new UsageError(`${id} has no client-exception declaration`);
    const address = { host: m[1]!, port: Number(m[2]) };
    const f = loadRepo(ROOT).frameworks.find((x) => x.id === id);
    if (f === undefined) console.log(`${id} has no rb.json that loads, so no skip and no scope applies`);
    const result = await gateAt(id, host, address, f, () => listening(address.host, address.port));
    report(result);
    if (values.exemplars) writeExemplars(id, host, result.exchanges);
    return result.passed ? 0 : 1;
  }

  if (positionals.length !== 1) throw new UsageError("name one framework, or pass --at and --framework");
  const [f] = frameworks(positionals);
  const entry = f!.rb.hosts[host];
  if (entry === undefined) throw new UsageError(`${f!.id} does not implement ${host}`);
  const at = atOf(values.commit);
  console.log(`build ${f!.id} for ${host}${at === undefined ? " from the working tree" : ` at ${at.slice(0, 12)}`}`);
  let built: container.Built;
  try {
    built = await container.build(ROOT, f!, host, entry, at);
  } catch (error) {
    console.log(`build failed: ${(error as Error).message}`);
    return 1;
  }
  const running = container.start(ROOT, built, f!, host);
  try {
    const ready = await container.probe(running.address, LADDER.bootSeconds * 1000, running.alive);
    console.log(`ready in ${Math.round(ready.readyMs)} ms at ${running.address.host}:${running.address.port}`);
    const result = await gateAt(f!.id, host, running.address, f, async () => running.alive());
    report(result);
    if (values.exemplars) writeExemplars(f!.id, host, result.exchanges);
    return result.passed ? 0 : 1;
  } catch (error) {
    console.log(`boot failed: ${(error as Error).message}\n${running.logs()}`);
    return 1;
  } finally {
    running.stop();
  }
}

async function measureCommand(args: string[]): Promise<number> {
  const { values, positionals } = parse(args, {
    host: { type: "string" },
    seconds: { type: "string" },
    only: { type: "string" },
  });
  const host = hostOf(values.host);
  spoken(host);
  const chosen = frameworks(positionals).filter((f) => Object.hasOwn(f.rb.hosts, host));
  if (chosen.length === 0) throw new UsageError(`no framework with an rb.json that loads implements ${host}`);
  const seconds = values.seconds === undefined ? undefined : Number(values.seconds);
  if (seconds !== undefined && !(seconds > 0)) throw new UsageError(`--seconds has to be a positive number, not ${values.seconds}`);
  const only = values.only?.split(",").map((s) => s.trim()).filter((s) => s !== "");

  const head = resolveCommit(ROOT);
  const changed = dirty(ROOT);
  const notRecorded = [
    ...(process.platform === "linux" ? [] : ["not Linux, so the load reached the framework through a published port"]),
    ...(changed.length === 0 ? [] : [`the working tree has ${changed.length} changed file(s)`]),
    ...(pushed(ROOT, head) ? [] : ["the commit is not pushed, so no link to its code can open"]),
    ...(seconds === undefined ? [] : ["the rungs were shortened"]),
    ...(only === undefined ? [] : ["only part of the corpus was offered"]),
  ];
  // A clean tree builds from the commit, so every image is exactly the files its bundle names.
  const at = changed.length === 0 ? head : undefined;
  const built = new Map<string, container.Built>();
  const driver: Driver = {
    build: async (f) => {
      const b = await container.build(ROOT, f, host, f.rb.hosts[host]!, at);
      built.set(f.id, b);
      return { imageId: b.imageId, imageBytes: b.imageBytes };
    },
    start: (f) => container.start(ROOT, built.get(f.id)!, f, host),
  };
  const genCpus = process.env["RB_GEN_CPUS"]?.trim();
  const dockerVersion = spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], { encoding: "utf8" }).stdout?.trim();
  const run = await measure({
    root: ROOT,
    host,
    frameworks: chosen,
    driver,
    phases: phasesOf(seconds),
    ladder: LADDER.version,
    only,
    bootMs: LADDER.bootSeconds * 1000,
    cooldownMs: LADDER.cooldownMs,
    notRecorded,
    at,
    machine: await machineState(),
    budget: { ...container.budget(), ...(genCpus ? { genCpus } : {}) },
    tools: { node: process.version, ...(dockerVersion ? { docker: dockerVersion } : {}) },
    outDir: join(ROOT, "results", "runs"),
    workers: genCpus ? cpuList(genCpus).size : undefined,
  });
  return run.frameworks.every((f) => f.load !== undefined) ? 0 : 1;
}

function summarizeCommand(args: string[]): number {
  const { values, positionals } = parse(args, { out: { type: "string" } });
  if (positionals.length !== 1) throw new UsageError("name one run file");
  const text = JSON.stringify(summarize(JSON.parse(readFileSync(positionals[0]!, "utf8")) as RunFile));
  if (values.out === undefined) console.log(text);
  else {
    mkdirSync(dirname(values.out), { recursive: true });
    writeFileSync(values.out, text);
  }
  return 0;
}

// ---- suite, client, upgrade ------------------------------------------------------------

function runIn(f: LoadedFramework, command: { argv: readonly string[]; cwd?: string | undefined; env?: Readonly<Record<string, string>> | undefined }, env: Record<string, string> = {}): number {
  const cwd = join(ROOT, f.dir, command.cwd ?? ".");
  console.log(`${f.id}: ${command.argv.join(" ")}${command.cwd ? ` (in ${command.cwd})` : ""}`);
  const r = spawnSync(command.argv[0]!, command.argv.slice(1), { cwd, stdio: "inherit", env: { ...process.env, ...command.env, ...env } });
  if (r.error) console.log(`  ${r.error.message}`);
  return r.status ?? 1;
}

function suiteCommand(args: string[]): number {
  const { positionals } = parse(args, {});
  let failed = 0;
  for (const f of frameworks(positionals)) {
    if (f.rb.suite === undefined) {
      console.log(`${f.id} declares no suite`);
      continue;
    }
    // The same data a container gets, by a path on this machine.
    if (runIn(f, f.rb.suite, { RB_PAYLOADS: join(ROOT, "tests", "payloads") }) !== 0) failed++;
  }
  return failed === 0 ? 0 : 1;
}

function clientCommand(args: string[]): number {
  const { positionals } = parse(args, {});
  let failed = 0;
  for (const f of frameworks(positionals)) {
    if (f.rb.client === undefined) {
      console.log(`${f.id} declares no client`);
      continue;
    }
    // A document step starts the application, which loads the payloads as it does in a container.
    if (runIn(f, f.rb.client, { RB_PAYLOADS: join(ROOT, "tests", "payloads") }) !== 0) {
      failed++;
      continue;
    }
    // The index holds the client as committed or staged, so what the command wrote beyond it is drift.
    const drift = unstaged(ROOT, `${f.dir}/Client/`);
    if (drift.length > 0) {
      console.log(`  ${f.id}'s Client/ is not what its generator writes: ${drift.join(", ")}`);
      failed++;
    } else console.log(`  ${f.id}'s Client/ is current`);
  }
  return failed === 0 ? 0 : 1;
}

function upgrade(args: string[]): number {
  const { positionals } = parse(args, {});
  if (positionals.length === 0) throw new UsageError("name the frameworks to upgrade");
  if (dirty(ROOT).length > 0) throw new UsageError("upgrade needs a clean working tree, so what moved is only the upgrade");
  let failed = 0;
  for (const f of frameworks(positionals)) {
    if (f.rb.upgrade === null) {
      console.log(`${f.id} moves its pins by hand`);
      continue;
    }
    if (runIn(f, f.rb.upgrade) !== 0) {
      failed++;
      continue;
    }
    const moved = dirty(ROOT);
    const outside = moved.filter((p) => !p.startsWith(`${f.dir}/`));
    if (outside.length > 0) {
      console.log(`  ${f.id}'s upgrade changed files outside its directory: ${outside.join(", ")}`);
      failed++;
      continue;
    }
    if (moved.length === 0) {
      console.log(`  ${f.id} is already current`);
      continue;
    }
    // The lockfiles are transitive churn. The rest is the change a reviewer reads.
    const locks = (f.rb.lockfile ?? []).map((l) => `:(exclude)${f.dir}/${l}`);
    console.log(git(ROOT, ["--no-pager", "diff", "--", `${f.dir}/`, ...locks]) || "  only the lockfiles moved");
    console.log(git(ROOT, ["--no-pager", "diff", "--stat", "--", `${f.dir}/`]));
  }
  return failed === 0 ? 0 : 1;
}

const COMMANDS: Record<string, (args: string[]) => number | Promise<number>> = {
  list,
  check,
  bundle,
  snippets,
  siteview,
  validate,
  measure: measureCommand,
  summarize: summarizeCommand,
  suite: suiteCommand,
  client: clientCommand,
  upgrade,
};

async function main(argv: string[]): Promise<number> {
  const [command, ...args] = argv;
  if (command === undefined || command === "help" || command === "--help") {
    console.log(USAGE);
    return command === undefined ? 2 : 0;
  }
  const run = COMMANDS[command];
  if (run === undefined) throw new UsageError(`${command} is not a command`);
  return run(args);
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  if (!(error instanceof UsageError)) throw error;
  console.error(`${USAGE}\n\nrb: ${error.message}`);
  process.exitCode = 2;
}
