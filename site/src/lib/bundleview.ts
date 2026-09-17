// Reading harness/siteview.py: the bundle and the handlers at the commit a run recorded.
//
// The seam is a subprocess and a parsed document. snippets.py stays the only thing that
// decides where a handler starts and ends; see harness/siteview.py for why that is not
// ported here.
import { execFileSync } from "node:child_process";
import { z } from "zod";
import { ROOT } from "./config.js";

export const ManifestFile = z.object({
  path: z.string(),
  role: z.string(),
  bytes: z.number(),
  hash: z.string(),
});
export type ManifestFile = z.infer<typeof ManifestFile>;

export const Manifest = z.object({
  bundle_version: z.string(),
  target: z.string(),
  bundle_hash: z.string(),
  code_hash: z.string(),
  commit: z.string(),
  files: z.array(ManifestFile),
});
export type Manifest = z.infer<typeof Manifest>;

// One range of one file. `context` is the blocks a fragment is nested in, which snippets.py
// works out so the gate can tell a handler from a condition; it rides through undeclared.
export const SnippetPart = z
  .object({
    path: z.string(),
    start_line: z.number(),
    end_line: z.number(),
    hash: z.string(),
    how: z.string(),
    text: z.string(),
  })
  .passthrough();
export type SnippetPart = z.infer<typeof SnippetPart>;

// A handler and the parts that make it work. Support comes from other files than the handler
// -- express mounts its gzip three statements above the route that never mentions it -- so
// each part carries its own path, range and hash rather than sharing the handler's.
export const Snippet = z
  .object({
    endpoint: z.string(),
    target: z.string(),
    handler: SnippetPart,
    support: z.array(SnippetPart),
    test: z.array(SnippetPart).default([]),
  })
  .passthrough();
export type Snippet = z.infer<typeof Snippet>;

// What one family is wired with in one target, from spec/matrix.json: either a named
// mechanism and the dependency behind it, or the reason there is nothing to show. A family
// with neither is a gate failure, not something a page has to render.
export const Mechanism = z
  .object({
    mechanism: z.string().optional(),
    dep: z.string().optional(),
    builtin: z.string().optional(),
  })
  .passthrough();
export type Mechanism = z.infer<typeof Mechanism>;

export const TargetView = z.object({
  manifest: Manifest,
  snippets: z.record(z.string(), Snippet),
  problems: z.array(z.string()),
  mechanisms: z.record(z.string(), Mechanism).default({}),
  pushed: z.boolean(),
  readme: z.string(),
});
export type TargetView = z.infer<typeof TargetView>;

const SiteViewDoc = z.object({
  commit: z.string(),
  repo: z.string(),
  targets: z.record(z.string(), TargetView.nullable()),
});

/** `why` is set when history could not answer, and is what the build prints. */
export type SiteView = z.infer<typeof SiteViewDoc> & { why?: string };

/**
 * The view of every named target at one commit, or an empty one when history cannot answer.
 *
 * An empty view is not an error: a shallow checkout has one commit and every page then says
 * its source is unavailable, which is what it should say. The build prints how many.
 */
export function siteView(targets: string[], at: string): SiteView {
  const empty = (why: string): SiteView => ({ commit: at, repo: "", targets: {}, why });
  if (!targets.length) return empty("no targets in this run");
  if (!at) return empty("this run recorded no commit");
  let raw: string;
  try {
    raw = execFileSync("python3", [`${ROOT}/harness/siteview.py`, "--at", at, ...targets], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
    });
  } catch (e) {
    const err = e as { stderr?: Buffer | string; message?: string };
    const detail = String(err.stderr ?? err.message ?? "").trim().split("\n").pop();
    return empty(`harness/siteview.py failed: ${detail}`);
  }
  const parsed = SiteViewDoc.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return empty(
      `harness/siteview.py wrote an unexpected document` +
        (first ? ` (${first.path.join(".")}: ${first.message})` : ""),
    );
  }
  return parsed.data;
}

/**
 * Whether the bundle in history is the one the run recorded, and whether it can be linked.
 *
 * A permalink to a commit that was never pushed is a 404, which reads as the code having been
 * deleted rather than as the run having been local.
 */
export function verdictOf(
  view: TargetView | null | undefined,
  recorded: string | undefined,
): { verified: boolean; linkable: boolean } {
  if (!view) return { verified: false, linkable: false };
  const verified = Boolean(recorded) && view.manifest.bundle_hash === recorded;
  return { verified, linkable: verified && view.pushed };
}

/**
 * blob rather than raw, so the reader gets highlighting and can browse outward, and the full
 * SHA rather than a branch, so a link from a run in March still opens March's code. A
 * one-line range is #L30, which is what GitHub's own copy-link produces.
 */
export function permalink(
  repo: string,
  commit: string,
  path: string,
  start: number,
  end: number,
): string {
  const frag = start === end ? `#L${start}` : `#L${start}-L${end}`;
  return `https://github.com/${repo}/blob/${commit}/${path}${frag}`;
}

/** One range: where it is, whether it links, and what it says. */
export type CodePart = { f: string; s: number; e: number; h: string; u: string | null; t: string };

/** The handler, the support parts behind it, the contract tests that hold it, and what its
 *  family declares it is wired with. */
export type CodeEntry = CodePart & {
  sup: CodePart[];
  tst: CodePart[];
  w?: { m?: string | undefined; d?: string | undefined; b?: string | undefined };
};

/** Every endpoint's handler for one target, and the support parts that make it work.
 *
 *  Short keys, because this ships to the browser next to the run it describes. */
export function snippetDoc(
  view: TargetView,
  repo: string,
  commit: string,
  linkable: boolean,
): Record<string, CodeEntry> {
  const part = (p: SnippetPart): CodePart => ({
    f: p.path,
    s: p.start_line,
    e: p.end_line,
    h: p.how,
    u: linkable && repo ? permalink(repo, commit, p.path, p.start_line, p.end_line) : null,
    t: p.text,
  });
  const out: Record<string, CodeEntry> = {};
  for (const [eid, sn] of Object.entries(view.snippets)) {
    const w = view.mechanisms[eid.split(".")[0] ?? ""];
    out[eid] = {
      ...part(sn.handler),
      sup: sn.support.map(part),
      tst: sn.test.map(part),
      ...(w ? { w: { m: w.mechanism, d: w.dep, b: w.builtin } } : {}),
    };
  }
  return out;
}
