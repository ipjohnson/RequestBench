// What the build was asked for, read once from the environment.
//
// tools/build.ts parses the command line and puts the answers here, because an Astro page is
// imported by the build rather than called by it and has no argv of its own.
import fs from "node:fs";
import path from "node:path";

/**
 * The repository root, which is where orchestrator/ and tests/ are.
 *
 * Not derived from import.meta.url: this module is bundled before it runs, and the bundle sits
 * in Astro's build scratch rather than beside the source. tools/build.ts names it, and running
 * `astro dev` or `astro build` straight out of site/ falls back to the parent of the working
 * directory, which is the same place.
 */
function repoRoot(env: NodeJS.ProcessEnv): string {
  for (const candidate of [env["RB_ROOT"], path.resolve(process.cwd(), ".."), process.cwd()]) {
    if (candidate && fs.existsSync(path.join(candidate, "orchestrator", "cli.ts"))) return candidate;
  }
  return path.resolve(process.cwd(), "..");
}

export type BuildConfig = {
  root: string;
  /** Where summaries are read from, or null for a shell that fetches everything at runtime. */
  summaries: string | null;
  exemplars: string;
  /**
   * Where the browser looks for run, wire and code documents. Relative to the page when unset,
   * which is the data directory this build writes. Point it at another site and the explorer
   * reads that site's catalog instead, so the results can live in their own repo without this
   * one rebuilding to follow them.
   */
  dataBase: string | null;
  /**
   * Whether a run that is not recorded is shown. Every run made off Linux, from a changed
   * working tree, from a commit nobody pushed or with shortened rungs is one, so this is how a
   * local run is looked at.
   */
  unrecorded: boolean;
};

export function buildConfig(env: NodeJS.ProcessEnv = process.env): BuildConfig {
  const root = repoRoot(env);
  const abs = (p: string): string => (path.isAbsolute(p) ? p : path.resolve(root, p));
  const summaries = env["RB_SUMMARIES"];
  return {
    root,
    summaries: summaries ? abs(summaries) : null,
    exemplars: abs(env["RB_EXEMPLARS"] || "results/exemplars"),
    dataBase: env["RB_DATA_BASE"] || null,
    unrecorded: env["RB_UNRECORDED"] === "1",
  };
}
