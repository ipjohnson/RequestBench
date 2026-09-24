// Reading `rb siteview`: the bundles, the snippets and the tests at the commit a run recorded.
//
// The seam is a subprocess and a parsed document, as it was when siteview was Python.
// orchestrator/snippets.ts stays the only thing that decides where a handler starts and ends,
// and the corpus it reads loads its payloads from beside its own source, which a module bundled
// into Astro's build scratch cannot do. So the build runs the command once and parses what it
// prints, and nothing here imports the orchestrator.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { z } from "zod";

export const BundleFile = z.object({
  path: z.string(),
  role: z.string(),
  bytes: z.number(),
  hash: z.string(),
});
export type BundleFile = z.infer<typeof BundleFile>;

export const Bundle = z.object({
  bundleVersion: z.string(),
  id: z.string(),
  commit: z.string(),
  bundleHash: z.string(),
  codeHash: z.string(),
  files: z.array(BundleFile),
});
export type Bundle = z.infer<typeof Bundle>;

// One range of one file. `context` is the blocks a fragment is nested in, which snippets.ts
// works out so the gate can tell a handler from a condition. `scope` is what a test mark was
// written for: one test by name, a family, or the whole framework.
export const Part = z.looseObject({
  path: z.string(),
  startLine: z.number(),
  endLine: z.number(),
  hash: z.string(),
  how: z.string(),
  text: z.string(),
  context: z.array(z.object({ line: z.number(), text: z.string() })).default([]),
  scope: z.string().optional(),
});
export type Part = z.infer<typeof Part>;

// A handler and the parts that make it work. Support comes from other files than the handler,
// so each part carries its own path, range and hash rather than sharing the handler's.
export const Snippet = z.looseObject({
  endpoint: z.string(),
  target: z.string(),
  handler: Part.nullable(),
  support: z.array(Part).default([]),
  test: z.array(Part).default([]),
});
export type Snippet = z.infer<typeof Snippet>;

// What one family is wired with, from rb.json: either a named mechanism and the dependency
// behind it, or the reason there is nothing to show.
export const Mechanism = z.looseObject({
  mechanism: z.string().optional(),
  dependency: z.string().optional(),
  builtin: z.string().optional(),
});
export type Mechanism = z.infer<typeof Mechanism>;

/** What the project is called and where to read it, from rb.json. */
export const Project = z.looseObject({
  framework: z.string(),
  licence: z.string(),
  repo: z.string(),
  package: z.string(),
  docs: z.string().optional(),
});
export type Project = z.infer<typeof Project>;

export const FrameworkView = z.object({
  bundle: Bundle,
  snippets: z.record(z.string(), Snippet),
  problems: z.array(z.string()),
  mechanisms: z.record(z.string(), Mechanism).default({}),
  project: Project.optional(),
  /** The items of the README's `## Notes`, which the page ends with. */
  notes: z.array(z.string()).default([]),
  pushed: z.boolean(),
});
export type FrameworkView = z.infer<typeof FrameworkView>;

/** The start of a body as it goes on the wire, and the size of all of it. */
const BodyView = z.object({ text: z.string(), bytes: z.number(), truncated: z.boolean() });

/**
 * What one call of a test sends, and what it checks on the answer. Rules are prose with
 * literals in backticks. `status` is null where any status passes, and 4XX where the status is
 * the one the framework declares under `declared`.
 */
export const CallView = z.object({
  method: z.string(),
  target: z.string(),
  headers: z.array(z.object({ name: z.string(), value: z.string(), note: z.string().optional() })),
  body: BodyView.extend({ payload: z.string().optional() }).optional(),
  status: z.string().nullable(),
  declared: z.string().optional(),
  checks: z.array(z.object({ name: z.string(), rule: z.string() })),
  expect: BodyView.extend({ payload: z.string(), compared: z.string(), note: z.string().optional() }).optional(),
  bodyRule: z.string().optional(),
});
export type CallView = z.infer<typeof CallView>;

/** A call made before the measured one, and what the test reads from its answer. */
export const PrimeView = z.object({ method: z.string(), target: z.string(), reads: z.array(z.string()) });
export type PrimeView = z.infer<typeof PrimeView>;

export const TestView = z.object({
  kind: z.string(),
  family: z.string(),
  about: z.string().default(""),
  method: z.string().optional(),
  path: z.string().optional(),
  base: z.string().optional(),
  varies: z.string().optional(),
  /** The test's own file, whole. */
  source: z.object({ path: z.string(), hash: z.string(), text: z.string() }),
  /** The payloads it sends or expects, by name. */
  payloads: z.array(z.string()).default([]),
  calls: z.array(CallView).default([]),
  primes: z.array(PrimeView).default([]),
});
export type TestView = z.infer<typeof TestView>;

export const TestsView = z.object({
  bundle: Bundle,
  tests: z.record(z.string(), TestView),
  families: z.record(z.string(), z.object({ about: z.string(), comparable: z.string() })).default({}),
  factors: z.record(z.string(), z.looseObject({ reads: z.string() })).default({}),
  pushed: z.boolean().default(false),
});
export type TestsView = z.infer<typeof TestsView>;

const SiteViewDoc = z.object({
  commit: z.string(),
  /** The files are the working tree's, based on `commit`, rather than the commit's own. */
  worktree: z.boolean().default(false),
  repo: z.string(),
  frameworks: z.record(z.string(), FrameworkView.nullable()),
  tests: TestsView,
});
export type SiteView = z.infer<typeof SiteViewDoc>;

/** The view, or why there is none, and what the command said about frameworks it could not read. */
export type SiteViewResult = { view: SiteView | null; why: string | null; warnings: string[] };

/**
 * The view of every framework and of the tests at one commit, or in the working tree when `at`
 * is null, or none when history cannot answer.
 *
 * No view is not an error: a shallow checkout has one commit and every page then renders
 * without its code, which is what it should do. The build prints why.
 */
export function siteView(root: string, at: string | null): SiteViewResult {
  const cli = path.join(root, "orchestrator", "cli.ts");
  const where = at === null ? ["--worktree"] : ["--at", at];
  const r = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--disable-warning=ExperimentalWarning", cli, "siteview", ...where],
    { cwd: root, encoding: "utf8", maxBuffer: 1 << 30 },
  );
  const warnings = (r.stderr ?? "").split("\n").filter((l) => l.trim() !== "");
  if (r.error) return { view: null, why: `rb siteview did not start: ${r.error.message}`, warnings };
  if (r.status !== 0) {
    // An uncaught error prints its source line and stack around the message.
    const said = warnings.find((l) => /^\w*Error: /.test(l)) ?? warnings.at(-1) ?? `exit ${r.status}`;
    return { view: null, why: `rb siteview ${where.join(" ")} failed: ${said}`, warnings: [] };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(r.stdout);
  } catch {
    return { view: null, why: "rb siteview printed something other than JSON", warnings };
  }
  const parsed = SiteViewDoc.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      view: null,
      why: `rb siteview wrote an unexpected document${first ? ` (${first.path.join(".")}: ${first.message})` : ""}`,
      warnings,
    };
  }
  return { view: parsed.data, why: null, warnings };
}

export type Verdict = { verified: boolean; linkable: boolean };

type Bundled = { readonly bundle: { readonly bundleHash: string }; readonly pushed: boolean };

/**
 * Whether the bundle in history is the one the run recorded, and whether it can be linked.
 *
 * A permalink to a commit that was never pushed is a 404, which reads as the code having been
 * deleted rather than as the run having been local.
 */
export function verdictOf(view: Bundled | null | undefined, recorded: string | undefined): Verdict {
  if (!view) return { verified: false, linkable: false };
  const verified = Boolean(recorded) && view.bundle.bundleHash === recorded;
  return { verified, linkable: verified && view.pushed };
}

/** Where a view's files were read. */
export type Source = "commit" | "worktree";

/**
 * The view a page shows for one bundle: the commit's when it is the bundle the run recorded,
 * else the working tree's when that is, else whichever there is, the working tree's first.
 *
 * Verification decides what the page links and what it says about the code, never whether the
 * code is shown. A run made from a changed working tree recorded a bundle no commit holds, so the
 * working tree is the nearest thing to what it measured, exactly so until the tree changes. The
 * page says which of these it is showing.
 */
export function pick<V extends Bundled>(
  atCommit: V | null | undefined,
  inTree: V | null | undefined,
  recorded: string | undefined,
): { view: V | null; from: Source; verdict: Verdict } {
  const c = verdictOf(atCommit, recorded);
  if (atCommit && c.verified) return { view: atCommit, from: "commit", verdict: c };
  const t = verdictOf(inTree, recorded);
  if (inTree) return { view: inTree, from: "worktree", verdict: { verified: t.verified, linkable: false } };
  return { view: atCommit ?? null, from: "commit", verdict: c };
}

/**
 * Why a page's code carries no links, or null when it does. The page shows the code either way.
 * `whose` names the bundle, because a page shows the framework's and the tests', and the two
 * verify separately.
 */
export function unlinkedWhy(v: Verdict, repo: string, commit: string, whose: string, from: Source = "commit"): string | null {
  if (v.linkable && repo) return null;
  const at = commit.slice(0, 12);
  if (from === "worktree") {
    return v.verified
      ? `${whose} files are read from the working tree, which hashes to the bundle this run recorded. No commit holds them, so nothing links to them.`
      : `${whose} files are read from the working tree, which has changed since this run, so they may differ from what ran. No commit holds them, so nothing links to them.`;
  }
  if (!v.verified) {
    return `${whose} files at ${at} do not hash to the bundle this run recorded, so what is shown may not be what ran, and nothing links to it.`;
  }
  if (!repo) return "The run recorded no repository, so nothing links to the code.";
  return `No remote branch holds ${at}, so nothing links to the code.`;
}

/**
 * blob rather than raw, so the reader gets highlighting and can browse outward, and the full
 * SHA rather than a branch, so a link from a run in March still opens March's code. A one-line
 * range is #L30, which is what GitHub's own copy-link produces, and a whole file has no range.
 */
export function permalink(repo: string, commit: string, file: string, start?: number, end?: number): string {
  const frag = start === undefined ? "" : start === end || end === undefined ? `#L${start}` : `#L${start}-L${end}`;
  return `https://github.com/${repo}/blob/${commit}/${file}${frag}`;
}

/** One range: where it is, whether it links, and what it says. */
export type CodePart = { f: string; s: number; e: number; h: string; u: string | null; t: string };

/** The handler, the support parts behind it, the tests that hold it, and what its family
 *  declares it is wired with. */
export type CodeEntry = CodePart & {
  sup: CodePart[];
  tst: CodePart[];
  w?: { m?: string | undefined; d?: string | undefined; b?: string | undefined };
};

/** Every test's handler for one framework, and the support parts that make it work.
 *
 *  Short keys, because this ships to the browser next to the run it describes. A test with no
 *  located handler has no entry. */
export function snippetDoc(view: FrameworkView, repo: string, commit: string, linkable: boolean): Record<string, CodeEntry> {
  const part = (p: Part): CodePart => ({
    f: p.path,
    s: p.startLine,
    e: p.endLine,
    h: p.how,
    u: linkable && repo ? permalink(repo, commit, p.path, p.startLine, p.endLine) : null,
    t: p.text,
  });
  const out: Record<string, CodeEntry> = {};
  for (const [id, sn] of Object.entries(view.snippets)) {
    if (!sn.handler) continue;
    const w = view.mechanisms[id.split(".")[0] ?? ""];
    out[id] = {
      ...part(sn.handler),
      sup: sn.support.map(part),
      tst: sn.test.map(part),
      ...(w ? { w: { m: w.mechanism, d: w.dependency, b: w.builtin } } : {}),
    };
  }
  return out;
}
