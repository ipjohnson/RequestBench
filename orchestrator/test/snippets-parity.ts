// Holds orchestrator/snippets.ts to upstream's harness/snippets.py on every framework upstream
// implemented at 9939f4c: the same records at the same lines with the same context, the same
// problems, the same assertion failures and the same requirements.
//
//   node --experimental-strip-types --disable-warning=ExperimentalWarning \
//     orchestrator/test/snippets-parity.ts [<scratch directory>]
//
// It needs python3, 3.11 or later for tomllib, and the upstream commit reachable from this
// repository's refs/remotes/origin/main. That ref is fetched into a scratch repository of its
// own, so this repository's index and worktrees are never touched. It is not part of npm test,
// because it needs Python and upstream's history.
//
// Upstream's tree has no problems, no requirement complaints and no assertion failures, so a
// clean run compares those only as empty lists. `--mutate` first breaks node:fastify in the
// scratch checkout in every way the checks look for, so both implementations have something to
// report.
//
// Three differences are deliberate and are mapped before comparing. The port reads rb.json and
// marks.ts where upstream read spec/matrix.json and spec/marks.json, so those names are swapped in
// messages. reads_expectation is called names_endpoint. reaches_domain and the per-family suite
// facilities are not ported, so upstream's are left out.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { AssertionName } from "../marks.ts";
import { assess, requirements, resolve, type Endpoint, type Mechanism, type Part, type SourceFile } from "../snippets.ts";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const UPSTREAM = "9939f4c";
const ARGS = process.argv.slice(2);
const MUTATE = ARGS.includes("--mutate");
const DIR = ARGS.find((a) => !a.startsWith("--")) ?? join(tmpdir(), "rb-snippets-parity");

const git = (cwd: string, ...args: string[]): string => execFileSync("git", args, { cwd, encoding: "utf8" });

function checkout(dir: string): void {
  if (!existsSync(join(dir, ".git"))) {
    mkdirSync(dir, { recursive: true });
    git(dir, "init", "-q");
    git(dir, "fetch", "-q", ROOT, "refs/remotes/origin/main");
  }
  git(dir, "checkout", "-q", "--force", "--detach", UPSTREAM);
}

function edit(dir: string, file: string, find: string, replace: string): void {
  const path = join(dir, file);
  const text = readFileSync(path, "utf8");
  if (!text.includes(find)) throw new Error(`${file} no longer holds ${JSON.stringify(find)}`);
  writeFileSync(path, text.replace(find, replace));
}

/** node:fastify broken once for every problem, requirement and assertion the port reports. */
function mutate(dir: string): void {
  const app = "targets/node/fastify/app.js";
  const suite = "targets/node/fastify/suite/json.test.js";
  // etag declares a mechanism and now marks no wiring for it.
  edit(dir, app, "// rb:wiring etag.*\n", "");
  // baseline is declared built in and now has wiring.
  edit(dir, app, 'app.get("/plaintext"', '// rb:wiring baseline.*\napp.get("/plaintext"');
  // json.small is registered twice, so it matches in two places and every coverage falls short.
  // Then a kind that does not exist, a mark naming nothing, a test mark in a source file, and a
  // handler that is nothing but a comment.
  edit(
    dir,
    app,
    "export async function handler(req, res) {",
    [
      'app.get("/json/small", () => d.payload("small"));',
      "// rb:bogus json.small",
      "// rb:handler nope.nothing",
      "// rb:test json.small",
      "const notATest = 1;",
      "// rb:handler parameters.static",
      "// a comment standing where a handler should be",
      "// rb:end",
      "export async function handler(req, res) {",
    ].join("\n"),
  );
  // json.medium loses its own test, json.large's test stops naming it, and wiring is marked in a
  // test file, which wiring may not read.
  edit(dir, suite, "// rb:test json.medium\n", "");
  edit(dir, suite, 'planned.ask("json.large")', 'planned.ask("json.huge")');
  edit(dir, suite, "// rb:test json.small\n", "// rb:wiring json.*\nconst stray = 1;\n// rb:test json.small\n");
  // json declares nothing, parameters declares neither kind, and compressed names a dependency
  // no manifest has and its wiring does not mention.
  const matrixPath = join(dir, "spec/matrix.json");
  const matrix = JSON.parse(readFileSync(matrixPath, "utf8")) as { mechanisms: Record<string, Record<string, Record<string, string>>> };
  const fastify = matrix.mechanisms["node:fastify"]!;
  delete fastify["json"];
  fastify["parameters"] = { note: "neither a mechanism nor builtin" };
  fastify["compressed"] = { ...fastify["compressed"], dep: "@fastify/squash" };
  writeFileSync(matrixPath, JSON.stringify(matrix, null, 2));
}

/** Upstream's own functions, run over every implemented target, with the suite facilities stubbed out. */
const DRIVER = `
import json, sys
sys.path.insert(0, "harness")
import bundle, snippets
snippets.facilities = lambda *a, **k: []
targets = {}
for language, name in bundle.implemented():
    found, problems = snippets.resolve(language, name)
    targets["%s:%s" % (language, name)] = {
        "language": language,
        "files": [{"path": e["path"], "role": e["role"], "hash": e["hash"]} for e in bundle.manifest(language, name)["files"]],
        "found": {eid: snippets.located(rec) for eid, rec in found.items()},
        "problems": problems,
        "requirements": snippets.requirements(language, name, found, True),
        "failed": snippets.assess(language, name, found),
        "mechanisms": snippets.mechanisms(language, name),
    }
json.dump({"endpoints": snippets.ENDPOINTS, "targets": targets}, sys.stdout)
`;

interface PyPart {
  path: string;
  start_line: number;
  end_line: number;
  how: string;
  context: { line: number; text: string }[];
  scope?: string;
}
interface PyRecord {
  handler: PyPart | null;
  support: PyPart[];
  test: PyPart[];
}
interface PyTarget {
  language: string;
  files: { path: string; role: string; hash: string }[];
  found: Record<string, PyRecord>;
  problems: string[];
  requirements: string[];
  failed: Record<string, string[]>;
  mechanisms: Record<string, Record<string, string>>;
}
interface PyOut {
  endpoints: { id: string; family: string; method: string; path: string; base?: string }[];
  targets: Record<string, PyTarget>;
}

// Upstream decodes as UTF-8 and keeps a byte order mark. TextDecoder drops one unless told not to.
const utf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

function decoded(dir: string, path: string): string | null {
  try {
    return utf8.decode(readFileSync(join(dir, path)));
  } catch {
    return null;
  }
}

const pyWhere = (p: PyPart | null): string =>
  p === null ? "none" : `${p.path}:${p.start_line}-${p.end_line} ${p.how} scope=${p.scope ?? ""} context=${JSON.stringify(p.context)}`;
const tsWhere = (p: Part | null): string =>
  p === null ? "none" : `${p.path}:${p.startLine}-${p.endLine} ${p.how} scope=${p.scope ?? ""} context=${JSON.stringify(p.context)}`;

const NAMES: Record<string, AssertionName | null> = {
  not_only_annotations: "not_only_annotations",
  mentions_dep: "mentions_dep",
  no_test: "no_test",
  reads_expectation: "names_endpoint",
  reaches_domain: null,
};

function differences(key: string, t: PyTarget, endpoints: readonly Endpoint[]): { records: number; diffs: string[] } {
  const files: SourceFile[] = [];
  const manifests: string[] = [];
  for (const f of t.files) {
    const text = decoded(DIR, f.path);
    if (text === null) continue;
    files.push({ path: f.path, text, hash: f.hash, role: f.role });
    if (f.role === "manifest") manifests.push(text);
  }
  // Every key rides through, with upstream's `dep` renamed: a declaration holding only a key
  // neither side reads is still a declaration, which is what "neither" reports.
  const mechanisms: Record<string, Mechanism> = {};
  for (const [family, decl] of Object.entries(t.mechanisms)) {
    const { dep, ...rest } = decl;
    mechanisms[family] = { ...rest, ...(dep === undefined ? {} : { dependency: dep }) } as Mechanism;
  }

  const { found, problems } = resolve({ target: key, language: t.language, files, endpoints });
  const failed = assess({ found, endpoints, mechanisms });
  const required = new Set(endpoints.map((e) => e.id));
  const reqs = requirements({ target: key, found, endpoints, required, mechanisms, manifestText: manifests.join("\n") });

  const diffs: string[] = [];
  const pyIds = Object.keys(t.found);
  const tsIds = Object.keys(found);
  for (const id of pyIds.filter((i) => !tsIds.includes(i))) diffs.push(`${id}: located by upstream only`);
  for (const id of tsIds.filter((i) => !pyIds.includes(i))) diffs.push(`${id}: located by the port only`);
  if (JSON.stringify(pyIds) !== JSON.stringify(tsIds) && diffs.length === 0) diffs.push(`records in a different order`);

  for (const id of pyIds.filter((i) => tsIds.includes(i))) {
    const py = t.found[id]!;
    const ts = found[id]!;
    if (pyWhere(py.handler) !== tsWhere(ts.handler)) diffs.push(`${id} handler: upstream ${pyWhere(py.handler)}, port ${tsWhere(ts.handler)}`);
    for (const into of ["support", "test"] as const) {
      const a = py[into].map(pyWhere);
      const b = ts[into].map(tsWhere);
      if (JSON.stringify(a) !== JSON.stringify(b)) diffs.push(`${id} ${into}: upstream ${JSON.stringify(a)}, port ${JSON.stringify(b)}`);
    }
  }

  const pyProblems = t.problems.map((p) => p.replaceAll("spec/marks.json", "orchestrator/marks.ts"));
  if (JSON.stringify(pyProblems) !== JSON.stringify(problems)) {
    diffs.push(`problems: upstream ${JSON.stringify(pyProblems)}, port ${JSON.stringify(problems)}`);
  }
  const pyReqs = t.requirements.map((r) => r.replaceAll("spec/matrix.json", "rb.json"));
  if (JSON.stringify(pyReqs) !== JSON.stringify(reqs)) diffs.push(`requirements: upstream ${JSON.stringify(pyReqs)}, port ${JSON.stringify(reqs)}`);

  for (const [name, subjects] of Object.entries(t.failed)) {
    const ours = NAMES[name];
    if (ours === undefined) {
      diffs.push(`upstream asserts ${name}, which the parity script does not map`);
      continue;
    }
    if (ours === null) continue;
    if (JSON.stringify(subjects) !== JSON.stringify(failed[ours])) {
      diffs.push(`${name}: upstream ${JSON.stringify(subjects)}, port ${JSON.stringify(failed[ours])}`);
    }
  }
  return { records: pyIds.length, diffs };
}

checkout(DIR);
if (MUTATE) mutate(DIR);
const py = JSON.parse(execFileSync("python3", ["-c", DRIVER], { cwd: DIR, encoding: "utf8", maxBuffer: 1 << 28 })) as PyOut;
const endpoints: Endpoint[] = py.endpoints.map((e) => ({
  id: e.id,
  family: e.family,
  method: e.method,
  path: e.path,
  ...(e.base === undefined ? {} : { base: e.base }),
}));

let records = 0;
let failing = 0;
let reported = 0;
const keys = Object.keys(py.targets);
for (const key of keys) {
  const t = py.targets[key]!;
  const { records: n, diffs } = differences(key, t, endpoints);
  records += n;
  const failures = Object.values(t.failed).reduce((sum, subjects) => sum + subjects.length, 0);
  const found = t.problems.length + t.requirements.length + failures;
  reported += found;
  const said = found === 0 ? "" : `, ${t.problems.length} problems, ${t.requirements.length} requirements, ${failures} failures`;
  console.log(`${key.padEnd(24)} ${String(n).padStart(3)} records${said}  ${diffs.length === 0 ? "agree" : `${diffs.length} DISAGREE`}`);
  for (const d of diffs) console.log(`  ${d}`);
  if (diffs.length > 0) failing += 1;
}
console.log(`\n${keys.length} targets, ${records} records, ${reported} findings, ${failing} target(s) disagreeing`);
// A mutated run leaves the scratch checkout as the next run expects to find it.
if (MUTATE) git(DIR, "checkout", "-q", "--force", "--detach", UPSTREAM);
process.exitCode = failing === 0 ? 0 : 1;
