// Reading the two inputs: the summaries runs wrote, and the exemplars the gate captured.
import fs from "node:fs";
import path from "node:path";
import { Exemplars, Run, type WireDoc } from "./types.ts";

/** Every *.json under a directory, sorted, so a build is the same twice over. */
function jsonFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && e.name.endsWith(".json") && !e.name.startsWith(".")) out.push(p);
    }
  };
  walk(dir);
  return out.sort();
}

/** A file that could not be read, and the first thing wrong with it. */
export type Rejected = { file: string; why: string };

export type LoadReport = {
  runs: Run[];
  /**
   * The same documents as they were read, by run id.
   *
   * What the site publishes is the summary, not this build's reading of it. A parse reorders
   * keys and drops what it was not told about, and republishing that would make the file a
   * reader downloads differ from the file the run wrote. The one change is that the per-test
   * histograms are published in a document of their own, so that a page showing no blend does
   * not download them.
   */
  raw: Map<string, unknown>;
  rejected: Rejected[];
};

export function loadRuns(dir: string): LoadReport {
  const runs: Run[] = [];
  const raw_ = new Map<string, unknown>();
  const rejected: Rejected[] = [];
  for (const f of jsonFiles(dir)) {
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(f, "utf8"));
    } catch (e) {
      rejected.push({ file: f, why: e instanceof Error ? e.message : "not JSON" });
      continue;
    }
    const parsed = Run.safeParse(raw);
    if (!parsed.success) {
      // Name the field. A run dropped silently is a page that quietly says less than it
      // should, and the cause is always one key whose type moved.
      const first = parsed.error.issues[0];
      rejected.push({ file: f, why: first ? `${first.path.join(".")}: ${first.message}` : "did not parse" });
      continue;
    }
    runs.push(parsed.data);
    raw_.set(parsed.data.runId, raw);
  }
  runs.sort((a, b) => (a.runId < b.runId ? -1 : a.runId > b.runId ? 1 : 0));
  return { runs, raw: raw_, rejected };
}

/** Bodies are trimmed for display; the whole excerpt stays in the exemplar file. */
export const BODY_LIMIT = 700;

/** One request/response pair per test per framework, captured by the gate. */
export function loadExemplars(dir: string): Record<string, WireDoc> {
  const out: Record<string, WireDoc> = {};
  for (const f of jsonFiles(dir)) {
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(f, "utf8"));
    } catch {
      continue;
    }
    const parsed = Exemplars.safeParse(raw);
    if (!parsed.success) continue;
    const doc = parsed.data;
    const tests: WireDoc["tests"] = {};
    for (const [id, { request: req, response: res }] of Object.entries(doc.tests)) {
      tests[id] = {
        family: id.split(".")[0] ?? "",
        m: req.method,
        p: req.target,
        rh: req.headers,
        rb: (req.body ?? "").slice(0, BODY_LIMIT),
        rbz: req.bodyBytes,
        s: res.status,
        sh: res.headers,
        shz: res.headerBytes,
        sbz: res.bodyBytes,
        fr: res.framing,
        sb: res.body.slice(0, BODY_LIMIT),
        tr: res.truncated || res.body.length > BODY_LIMIT,
      };
    }
    // <language>-<name>@<host>
    out[path.basename(f, ".json")] = { framework: doc.framework, host: doc.host, tests };
  }
  return out;
}

/**
 * Exemplars whose test ids match nothing any run measured.
 *
 * Such a capture shows an empty pane with nothing on the page to say why, which is how
 * captures from before a corpus change survive it unnoticed.
 */
export function staleExemplars(runs: Run[], wire: Record<string, WireDoc>): string[] {
  const known = new Set(runs.flatMap((r) => r.frameworks.flatMap((f) => Object.keys(f.tests ?? {}))));
  if (!known.size) return [];
  return Object.entries(wire)
    .filter(([, v]) => !Object.keys(v.tests).some((id) => known.has(id)))
    .map(([k]) => k)
    .sort();
}
