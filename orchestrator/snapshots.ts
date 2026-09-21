// The snapshot beside each refusal row: the one request it sends, and each
// framework's own answer to it as that framework was captured giving it.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { Json } from "@rb/tests/kit";

export interface Snapshot {
  readonly request: string;
  readonly frameworks: Readonly<Record<string, { readonly status: number; readonly body?: Json; readonly bodyFrom?: string }>>;
}

/** `tests/<family>/<name>.ts` for a test id, with the name's underscores as hyphens. */
export function fileOf(id: string, extension = ".ts"): string {
  const [family, name] = id.split(".") as [string, string];
  return `tests/${family}/${name.replace(/_/g, "-")}${extension}`;
}

/** The snapshot beside each test that has one. Only refusal rows do. */
export function loadSnapshots(root: string, ids: Iterable<string>): Map<string, Snapshot> {
  const out = new Map<string, Snapshot>();
  for (const id of ids) {
    const file = join(root, fileOf(id, ".snap.json"));
    if (existsSync(file)) out.set(id, JSON.parse(readFileSync(file, "utf8")) as Snapshot);
  }
  return out;
}
