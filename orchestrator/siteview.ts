// What the site reads about the code behind a run, at the commit the run recorded: each
// framework's bundle, where each test is answered, what each family is wired with and the
// README; and the tests bundle, with each test's own source. A port of upstream's
// harness/siteview.py, which put bundle.py and snippets.py together for the site build.
//
// Everything is read from history at that commit, so a page about a run from March shows the
// code that ran in March. The endpoints are the working tree's corpus, as upstream read
// spec/endpoints.json from the working tree, because a corpus is TypeScript and cannot be
// imported as it stood at another commit.
import type { Factor, Suite } from "@rb/tests/kit";
import { frameworkBundle, frameworkDir, frameworkId, testFiles, testsBundle, type Bundle, type FrameworkKey } from "./bundle.ts";
import { endpoints, isPayload, recordAll, subjectOf } from "./corpus.ts";
import { blob, pushed } from "./git.ts";
import { KINDS } from "./marks.ts";
import { rbJsonSchema, type RbJson } from "./manifest.ts";
import { notesOf } from "./notes.ts";
import type { Recording } from "./record.ts";
import { assess, requirements, resolve, type Endpoint, type Failures, type Mechanism, type SnippetRecord, type SourceFile } from "./snippets.ts";

/** The roles any mark kind may read. Nothing else is decoded. */
const READABLE: ReadonlySet<string> = new Set(Object.values(KINDS).flatMap((k) => k.roles));

const utf8 = new TextDecoder("utf-8", { fatal: true });

/** A bundle's readable files as text. A file that is not UTF-8 holds no route anyone could read. */
export function sourcesOf(root: string, bundle: Bundle, at: string | undefined, roles: ReadonlySet<string> = READABLE): SourceFile[] {
  const out: SourceFile[] = [];
  for (const f of bundle.files) {
    if (!roles.has(f.role)) continue;
    try {
      out.push({ path: f.path, text: utf8.decode(blob(root, f.path, at)), hash: f.hash, role: f.role });
    } catch {
      // not text
    }
  }
  return out;
}

/** rb.json as it stood at `at`, or undefined where it did not parse. A page still renders without it. */
export function rbJsonAt(root: string, f: FrameworkKey, at: string | undefined): RbJson | undefined {
  try {
    const parsed = rbJsonSchema.safeParse(JSON.parse(blob(root, `${frameworkDir(f)}/rb.json`, at).toString("utf8")));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export interface FrameworkView {
  readonly bundle: Bundle;
  /** By test id. A test with no located handler has no entry, unless it is in noHandler. */
  readonly snippets: Readonly<Record<string, SnippetRecord>>;
  /** The tests rb.json says the framework answers with no handler of its own, and what answers each. */
  readonly noHandler: Readonly<Record<string, string>>;
  /** Where a snippet could not be located, and what rb.json declared and the code did not bear out. */
  readonly problems: readonly string[];
  /** What each assertion in marks.ts found, by test id or family. */
  readonly failures: Failures;
  readonly mechanisms: Readonly<Record<string, Mechanism>>;
  /** What rb.json says the project is and where to read it. Absent where rb.json did not parse. */
  readonly project?: Pick<RbJson, "framework" | "licence" | "repo" | "package" | "docs">;
  readonly readme: string;
  /** The items of the README's `## Notes`, which the framework's page ends with. */
  readonly notes: readonly string[];
  /** Whether a link to the commit can open. A commit nobody pushed is a 404. */
  readonly pushed: boolean;
}

export function frameworkView(
  root: string,
  f: FrameworkKey,
  at: string | undefined,
  eps: readonly Endpoint[],
  required: ReadonlySet<string>,
): FrameworkView {
  const target = frameworkId(f);
  const bundle = frameworkBundle(root, f, at);
  const rb = rbJsonAt(root, f, at);
  const mechanisms = rb?.mechanisms ?? {};
  const noHandler = rb?.noHandler ?? {};
  const unhandled = new Set(Object.keys(noHandler));
  const { found, problems } = resolve({ target, language: f.language, files: sourcesOf(root, bundle, at), endpoints: eps, noHandler: unhandled });
  // rb.json is a manifest too and names every dependency it declares, so it cannot be what
  // vouches that the framework depends on one.
  const manifestText = sourcesOf(root, bundle, at, new Set(["manifest"]))
    .filter((s) => !s.path.endsWith("/rb.json"))
    .map((s) => s.text)
    .join("\n");
  const readmePath = `${frameworkDir(f)}/README.md`;
  const readme = bundle.files.some((x) => x.path === readmePath) ? blob(root, readmePath, at).toString("utf8") : "";
  return {
    bundle,
    snippets: found,
    noHandler,
    problems: [...problems, ...requirements({ target, found, endpoints: eps, required, mechanisms, manifestText, noHandler: unhandled })],
    failures: assess({ found, endpoints: eps, mechanisms }),
    mechanisms,
    ...(rb === undefined
      ? {}
      : { project: { framework: rb.framework, licence: rb.licence, repo: rb.repo, package: rb.package, ...(rb.docs === undefined ? {} : { docs: rb.docs }) } }),
    readme,
    notes: notesOf(readme)?.items ?? [],
    pushed: at === undefined ? false : pushed(root, at),
  };
}

export interface TestView {
  readonly kind: "performance" | "validation";
  readonly family: string;
  /** What the call the test is about sends. A test declares its path and leaves the method inside its closure. */
  readonly method?: string;
  readonly path?: string;
  readonly base?: string;
  readonly varies?: string;
  /** The test's own file, whole: it is short, and it is the question. */
  readonly source: { readonly path: string; readonly hash: string; readonly text: string };
  /** The payloads it sends or expects, by name, so a page can link the committed files. */
  readonly payloads: readonly string[];
}

export interface TestsView {
  readonly bundle: Bundle;
  readonly tests: Readonly<Record<string, TestView>>;
  readonly families: Readonly<Record<string, { readonly about: string; readonly comparable: string }>>;
  readonly factors: Readonly<Record<string, Factor>>;
  /** Whether a link to the commit can open, as FrameworkView says for a framework. */
  readonly pushed: boolean;
}

/** Every payload a recording names, through what it is made from, in the order met. */
function payloadsIn(recording: Recording): string[] {
  const names = new Set<string>();
  const walk = (v: unknown): void => {
    if (v === null || typeof v !== "object") return;
    if (!Array.isArray(v) && isPayload(v)) {
      names.add(v.name);
      for (const from of v.from ?? []) walk(from);
      return;
    }
    for (const x of Array.isArray(v) ? v : Object.values(v)) walk(x);
  };
  for (const call of recording.calls) walk(call);
  return [...names];
}

export function testsView(root: string, at: string | undefined, s: Suite, recordings: ReadonlyMap<string, Recording>): TestsView {
  const bundle = testsBundle(root, at);
  const files = testFiles(bundle);
  const tests: Record<string, TestView> = {};
  for (const id of Object.keys(s.tests).sort()) {
    const t = s.tests[id]!;
    const file = files.get(id);
    if (file === undefined) continue;
    const method = subjectOf(recordings.get(id)!)?.method;
    tests[id] = {
      kind: t.kind,
      family: t.id.family,
      ...(method === undefined ? {} : { method }),
      ...(t.path === undefined ? {} : { path: t.path }),
      ...(t.kind === "performance" && t.base !== undefined ? { base: t.base, varies: t.varies! } : {}),
      source: { path: file.path, hash: file.hash, text: blob(root, file.path, at).toString("utf8") },
      payloads: payloadsIn(recordings.get(id)!),
    };
  }
  const families = Object.fromEntries(Object.values(s.families).map((f) => [f.name, { about: f.about, comparable: f.comparable }]));
  return { bundle, tests, families, factors: s.factors, pushed: at === undefined ? false : pushed(root, at) };
}

/** The corpus as snippets need it: its endpoints, and the performance tests every framework answers. */
export async function corpusEndpoints(s: Suite): Promise<{ endpoints: Endpoint[]; required: Set<string>; recordings: Map<string, Recording> }> {
  const recordings = await recordAll(s);
  const required = new Set(Object.entries(s.tests).filter(([, t]) => t.kind === "performance").map(([id]) => id));
  return { endpoints: endpoints(s, recordings), required, recordings };
}
