// Git, read the way a bundle needs it: which files exist and what bytes they hold, either in
// the working tree or at a commit, and never by walking the filesystem.
//
// Everything that takes `at` reads the working tree when it is undefined and history when it
// names a commit. A run records the commit it measured, so the site rebuilds what that run saw
// from history rather than from today's files.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export class GitError extends Error {}

/** Bytes, never decoded: a file is hashed, and a decode and encode is not always identity. */
export function gitBytes(root: string, args: readonly string[]): Buffer {
  try {
    return execFileSync("git", args, { cwd: root, maxBuffer: 1 << 30, stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    const stderr = String((error as { stderr?: Buffer }).stderr ?? "").trim();
    throw new GitError(`git ${args.join(" ")}: ${stderr || (error as Error).message}`);
  }
}

export const git = (root: string, args: readonly string[]): string => gitBytes(root, args).toString("utf8");

/** The tracked files under `prefix`, sorted bytewise. */
export function tracked(root: string, prefix: string, at?: string): string[] {
  const out =
    at === undefined
      ? git(root, ["ls-files", "-z", "--", prefix])
      : git(root, ["ls-tree", "-r", "-z", "--name-only", at, "--", prefix]);
  // Bytewise, which for UTF-8 is what comparing code units gives. A locale-aware sort would
  // differ between machines.
  return out
    .split("\0")
    .filter((p) => p !== "")
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function blob(root: string, path: string, at?: string): Buffer {
  return at === undefined ? readFileSync(join(root, path)) : gitBytes(root, ["cat-file", "blob", `${at}:${path}`]);
}

/** The full SHA a name resolves to, so what is recorded still means something a month later. */
export const resolveCommit = (root: string, name = "HEAD"): string =>
  git(root, ["rev-parse", "--verify", `${name}^{commit}`]).trim();

/**
 * The owner/name slug, so a fork's pages link to the fork's own code. GITHUB_REPOSITORY in
 * Actions, the origin remote otherwise, and empty where there is neither.
 */
export function repoSlug(root: string): string {
  const env = process.env["GITHUB_REPOSITORY"];
  if (env) return env;
  try {
    const url = git(root, ["remote", "get-url", "origin"]).trim();
    return /[:/]([^/:]+\/[^/]+?)(?:\.git)?$/.exec(url)?.[1] ?? "";
  } catch {
    return "";
  }
}

/**
 * Whether a remote-tracking branch holds this commit. A permalink to a commit that was never
 * pushed is a 404, which reads as the code having been deleted rather than as the run having
 * been local.
 */
export function pushed(root: string, at: string): boolean {
  try {
    return git(root, ["branch", "-r", "--contains", at]).trim() !== "";
  } catch {
    return false;
  }
}

/** Modified, staged and untracked paths under `prefix`, ignored files left out. */
export function dirty(root: string, prefix = "."): string[] {
  const fields = git(root, ["status", "--porcelain", "-z", "--untracked-files=all", "--", prefix]).split("\0");
  const out: string[] = [];
  for (let i = 0; i < fields.length; i++) {
    const entry = fields[i]!;
    if (entry.length < 4) continue;
    out.push(entry.slice(3));
    // A rename or copy is followed by the path it came from, which carries no status of its own.
    if (/[RC]/.test(entry.slice(0, 2))) i++;
  }
  return out;
}

/**
 * Paths under `prefix` whose working-tree bytes differ from the index, and untracked paths. What is
 * staged counts as settled, so a file rewritten with the bytes the index holds is not listed.
 */
export function unstaged(root: string, prefix = "."): string[] {
  const fields = git(root, ["status", "--porcelain", "-z", "--untracked-files=all", "--", prefix]).split("\0");
  const out: string[] = [];
  for (let i = 0; i < fields.length; i++) {
    const entry = fields[i]!;
    if (entry.length < 4) continue;
    if (entry[1] !== " ") out.push(entry.slice(3));
    if (/[RC]/.test(entry.slice(0, 2))) i++;
  }
  return out;
}
