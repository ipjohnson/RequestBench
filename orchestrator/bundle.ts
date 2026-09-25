// Bundles: every tracked file that decides how a framework, or the tests, behave, each with a
// role and a hash, rolled up into codeHash and bundleHash.
//
// A run records the two rollups and the commit. The files themselves are never stored: the site
// rebuilds a bundle from git at the recorded commit and refuses to show code whose rollup does
// not verify, because rendering today's file under an old number is the mistake this exists to
// prevent. Upstream's harness/bundle.py and docs/bundles.html are the design.
//
// Two rollups, because a corrected README or a sharpened test should produce a new page without
// reading as a framework that changed. codeHash leaves out the roles that do not change what
// runs; bundleHash covers every file.
//
// The rules below are bundle-v1. Changing any of them reissues every hash in the series, so a
// change is a new version:
//   - the file set comes from git, never a filesystem walk, so an editor backup or a build
//     artifact cannot enter it
//   - a framework's bundle is read for one host, and leaves out the directories named for the
//     other hosts, so a change to how one host starts the framework is no change on another
//   - paths are repo-relative and sorted bytewise
//   - a file's hash is SHA-256 over its bytes, as sha256:<hex>
//   - a rollup is SHA-256 over one `<hex>  <path>` line per file, which is sha256sum's own
//     format, so `sha256sum -c` verifies it from the repository root
//
// Without `at`, bytes come from the working tree, because a hash has to describe what actually
// ran. A dirty tree is then visible: its rollup does not verify against the commit.
import { createHash } from "node:crypto";

import { blob, resolveCommit, tracked } from "./git.ts";
import { HOST_IDS, type HostId } from "./hosts.ts";

export const BUNDLE_VERSION = "bundle-v1";

export type FrameworkRole = "source" | "manifest" | "config" | "host" | "contract" | "prose" | "test" | "client";
export type TestsRole = "test" | "family" | "kit" | "model" | "payload" | "snapshot" | "manifest" | "source" | "prose";
export type Role = FrameworkRole | TestsRole;

export interface BundleFile {
  /** Repo-relative, forward slashes. */
  readonly path: string;
  readonly role: Role;
  readonly bytes: number;
  readonly hash: string;
}

export interface Bundle {
  readonly bundleVersion: typeof BUNDLE_VERSION;
  /** `<language>:<name>` for a framework, `tests` for the tests. */
  readonly id: string;
  /** The commit the files were read at, or HEAD's when they came from the working tree. */
  readonly commit: string;
  readonly bundleHash: string;
  readonly codeHash: string;
  readonly files: readonly BundleFile[];
}

const sha256 = (bytes: Buffer | string): string => createHash("sha256").update(bytes).digest("hex");

/** SHA-256 over one `<hex>  <path>` line per file, in the order given, which is sorted. */
export function rollup(files: readonly Pick<BundleFile, "path" | "hash">[]): string {
  return `sha256:${sha256(files.map((f) => `${f.hash.slice("sha256:".length)}  ${f.path}\n`).join(""))}`;
}

function build(
  root: string,
  id: string,
  prefix: string,
  at: string | undefined,
  roleOf: (path: string) => Role,
  notCode: ReadonlySet<Role>,
  keep: (path: string) => boolean = () => true,
): Bundle {
  const paths = tracked(root, prefix, at).filter(keep);
  if (paths.length === 0) throw new Error(`${id} has no tracked files under ${prefix}`);
  const files = paths.map((path): BundleFile => {
    const bytes = blob(root, path, at);
    return { path, role: roleOf(path), bytes: bytes.length, hash: `sha256:${sha256(bytes)}` };
  });
  return {
    bundleVersion: BUNDLE_VERSION,
    id,
    commit: resolveCommit(root, at),
    bundleHash: rollup(files),
    codeHash: rollup(files.filter((f) => !notCode.has(f.role))),
    files,
  };
}

/**
 * The rollup of every tracked file under `prefix`, for something whose identity is its files
 * and which has no roles to tell apart, such as the traffic generator.
 */
export function treeRollup(root: string, prefix: string, at?: string): string {
  return rollup(tracked(root, prefix, at).map((path) => ({ path, hash: `sha256:${sha256(blob(root, path, at))}` })));
}

// ---- frameworks ------------------------------------------------------------------------

export interface FrameworkKey {
  readonly language: string;
  readonly name: string;
}

export const frameworkDir = (f: FrameworkKey): string => `frameworks/${f.language}/${f.name}`;

/** The name a reader types and a run records: `dotnet:carter`. */
export const frameworkId = (f: FrameworkKey): string => `${f.language}:${f.name}`;

const MANIFEST_NAMES = new Set([
  "rb.json",
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "go.mod",
  "go.sum",
  "pom.xml",
  "Cargo.toml",
  "Cargo.lock",
  "requirements.in",
  "requirements.txt",
  "pyproject.toml",
  "uv.lock",
  "Directory.Packages.props",
  "Directory.Build.props",
  "packages.lock.json",
  "nuget.config",
  "global.json",
]);
/** A .NET project or solution is named after itself, so it is matched by suffix. */
const MANIFEST_SUFFIXES = [".csproj", ".sln", ".slnx"];
const CONFIG_SUFFIXES = [".properties", ".yaml", ".yml", ".toml", ".ini", ".conf"];
/**
 * An API description a framework routes from says what it serves, so it is code. Matched by
 * name, because a .yaml beside a framework is far more often a setting.
 */
const CONTRACT_NAMES = new Set(["openapi.yaml", "openapi.yml", "openapi.json"]);
/**
 * The TypeScript that reads this framework's error bodies. The benchmark holds the framework to
 * it and the framework never runs it, so it is in the bundle as a test and out of codeHash.
 */
const CLIENT_EXCEPTION = "client-exception/";
/**
 * The OpenAPI document the framework writes about itself and the client generated from it. The
 * image never reads them, so they stay out of codeHash, and the handler finder never reads them,
 * because every route literal is in the document a second time.
 */
const CLIENT = "Client/";
/** Go keeps a test beside the code it tests, so it is told apart by name, as `go build` does. */
const TEST_SUFFIXES = ["_test.go"];
const FRAMEWORK_NOT_CODE: ReadonlySet<Role> = new Set(["prose", "test", "client"]);

/** A bundle missing any of these did not resolve, and a partial file set hashes as cleanly as a whole one. */
const FRAMEWORK_REQUIRED: readonly Role[] = ["source", "manifest", "host"];

const inside = (rel: string, dir: string): boolean => {
  const d = dir.replace(/^\.\/|\/$/g, "");
  return d === "" || d === "." || rel === d || rel.startsWith(`${d}/`);
};

/** The role of a file, from its path relative to the framework's directory. */
export function frameworkRole(rel: string, suitePaths: readonly string[]): FrameworkRole {
  const name = rel.slice(rel.lastIndexOf("/") + 1);
  // Before the name rules: a suite's own package.json is not a dependency of the framework.
  if (rel.startsWith(CLIENT_EXCEPTION) || suitePaths.some((p) => inside(rel, p)) || TEST_SUFFIXES.some((s) => name.endsWith(s))) {
    return "test";
  }
  // Before the name rules: Client/openapi.json is what the framework says it serves, not a contract it routes from.
  if (rel.startsWith(CLIENT)) return "client";
  if (CONTRACT_NAMES.has(name)) return "contract";
  if (name.endsWith(".md")) return "prose";
  if (MANIFEST_NAMES.has(name) || MANIFEST_SUFFIXES.some((s) => name.endsWith(s))) return "manifest";
  if (CONFIG_SUFFIXES.some((s) => name.endsWith(s))) return "config";
  if (name.startsWith("Dockerfile") || name === ".dockerignore") return "host";
  return "source";
}

/**
 * The suite's directories, as rb.json named them at the same commit. Read here rather than
 * from the loaded manifest so a bundle at an old commit uses the roles that commit declared.
 * Lenient on purpose: whether rb.json is valid is the loader's question, and a bundle has to
 * resolve for a framework whose manifest is wrong so the site can still say what it was.
 */
function suitePathsAt(root: string, dir: string, at: string | undefined): string[] {
  let raw: unknown;
  try {
    raw = JSON.parse(blob(root, `${dir}/rb.json`, at).toString("utf8"));
  } catch {
    return [];
  }
  const paths = (raw as { suite?: { paths?: unknown } } | null)?.suite?.paths;
  return Array.isArray(paths) ? paths.filter((p): p is string => typeof p === "string") : [];
}

/** The directories of every host but this one, relative to the framework's directory. */
const otherHosts = (host: HostId): string[] => HOST_IDS.filter((h) => h !== host).map((h) => `${h}/`);

export function frameworkBundle(root: string, f: FrameworkKey, host: HostId, at?: string): Bundle {
  const dir = frameworkDir(f);
  const suite = suitePathsAt(root, dir, at);
  const others = otherHosts(host);
  return build(
    root,
    frameworkId(f),
    `${dir}/`,
    at,
    (path) => frameworkRole(path.slice(dir.length + 1), suite),
    FRAMEWORK_NOT_CODE,
    (path) => !others.some((o) => path.slice(dir.length + 1).startsWith(o)),
  );
}

/** One complaint per role a framework bundle should hold and does not. */
export function frameworkProblems(b: Bundle): string[] {
  const roles = new Set(b.files.map((f) => f.role));
  const missing = FRAMEWORK_REQUIRED.filter((r) => !roles.has(r));
  return missing.length === 0 ? [] : [`${b.id} has no ${missing.join(" and no ")} file`];
}

// ---- the tests ---------------------------------------------------------------------------

/** The tests are a bundle of their own, so the site can show each test's source beside its numbers. */
export const TESTS_ID = "tests";
const TESTS_DIR = "tests";
const RESERVED = new Set(["kit", "models", "payloads"]);
/**
 * Snapshots hold the error bodies frameworks were captured writing, which only the reference
 * in orchestrator/test reads. Changing one changes no request and no answer a run checks.
 * Which questions were asked is the corpus version's business, not codeHash's: prose inside a
 * test file moves codeHash and leaves the corpus version alone.
 */
const TESTS_NOT_CODE: ReadonlySet<Role> = new Set(["prose", "snapshot"]);

export function testsRole(path: string): TestsRole {
  const seg = path.split("/").slice(1);
  const name = seg[seg.length - 1]!;
  if (name.endsWith(".md")) return "prose";
  if (name.endsWith(".snap.json")) return "snapshot";
  if (seg.length === 1) return name === "package.json" ? "manifest" : name === "index.ts" ? "family" : "source";
  const top = seg[0]!;
  if (top === "kit") return "kit";
  if (top === "models") return "model";
  if (top === "payloads") return "payload";
  if (seg.length === 2 && name.endsWith(".ts")) return name === "index.ts" ? "family" : "test";
  return "source";
}

export function testsBundle(root: string, at?: string): Bundle {
  return build(root, TESTS_ID, `${TESTS_DIR}/`, at, testsRole, TESTS_NOT_CODE);
}

/** The test file each corpus id is declared in, from the bundle alone: `json.small` is `tests/json/small.ts`. */
export function testFiles(b: Bundle): Map<string, BundleFile> {
  const out = new Map<string, BundleFile>();
  for (const f of b.files) {
    if (f.role !== "test") continue;
    const [, family, file] = f.path.split("/");
    if (family === undefined || file === undefined || RESERVED.has(family)) continue;
    // The file name is the id's name with dashes where the id has underscores.
    out.set(`${family}.${file.slice(0, -".ts".length).replaceAll("-", "_")}`, f);
  }
  return out;
}
