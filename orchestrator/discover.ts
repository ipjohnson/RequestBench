// What is in the corpus, found by scanning tracked files.
//
// `git ls-files` and never a filesystem walk. An untracked scratch file must not
// become a test, and the set has to be identical on every machine that checks out
// the same commit, which a walk cannot promise.
import { execFileSync } from "node:child_process";

export interface Discovered {
  /** `tests/<family>/index.ts`, by family. */
  readonly families: ReadonlyMap<string, string>;
  /** `tests/<family>/<name>.ts`. */
  readonly tests: readonly string[];
  /** `frameworks/<language>/<name>/rb.json`. */
  readonly frameworks: readonly string[];
}

/** kit, models and payloads hold the machinery, the schemas and the data. None is a family. */
const RESERVED = new Set(["kit", "models", "payloads"]);

/** The convention `_domain`, `_shared` and `_hosts` already rely on. */
const hidden = (path: string) => path.split("/").some((seg) => seg.startsWith("_"));

export function tracked(root: string): string[] {
  const out = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" });
  return out.split("\0").filter((p) => p !== "");
}

export function discover(root: string): Discovered {
  const families = new Map<string, string>();
  const tests: string[] = [];
  const frameworks: string[] = [];

  for (const path of tracked(root)) {
    if (hidden(path)) continue;
    const seg = path.split("/");

    if (seg[0] === "tests" && seg.length === 3 && seg[2]!.endsWith(".ts")) {
      const family = seg[1]!;
      if (RESERVED.has(family)) continue;
      if (seg[2] === "index.ts") families.set(family, path);
      else tests.push(path);
    } else if (seg[0] === "frameworks" && seg.length === 4 && seg[3] === "rb.json") {
      frameworks.push(path);
    }
  }

  return { families, tests: tests.sort(), frameworks: frameworks.sort() };
}
