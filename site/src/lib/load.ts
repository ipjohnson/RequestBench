// Reading the two inputs: the summaries a run wrote, and the exemplars the gate captured.
import fs from "node:fs";
import path from "node:path";
import { Capture, Run, type WireDoc } from "./types.js";

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

/**
 * Whether this summary holds per-endpoint statistics keyed by endpoint id.
 *
 * The shape changed when parallel arrays indexed by endpoint_order were replaced by a map. A
 * summary written before that is skipped rather than converted: reading it positionally is
 * the mistake the map exists to make impossible, and a converter would be code kept alive
 * for data nothing wants.
 */
export function isKeyed(r: unknown): boolean {
  const targets = (r as { targets?: unknown[] })?.targets ?? [];
  for (const t of targets) {
    const eps = (t as { endpoints?: unknown }).endpoints;
    if (eps && typeof eps === "object" && Object.keys(eps).length) {
      return Object.values(eps).every(
        (v) => v !== null && typeof v === "object" && "rungs" in (v as object),
      );
    }
  }
  return true;
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
   * reader downloads differ from the file the run wrote.
   */
  raw: Map<string, unknown>;
  rejected: Rejected[];
  stale: number;
};

export function loadRuns(dir: string): LoadReport {
  const runs: Run[] = [];
  const raw_ = new Map<string, unknown>();
  const rejected: Rejected[] = [];
  let stale = 0;
  for (const f of jsonFiles(dir)) {
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(f, "utf8"));
    } catch (e) {
      rejected.push({ file: f, why: e instanceof Error ? e.message : "not JSON" });
      continue;
    }
    if (!isKeyed(raw)) {
      stale += 1;
      continue;
    }
    const parsed = Run.safeParse(raw);
    if (!parsed.success) {
      // Name the field. A run dropped silently is a page that quietly says less than it
      // should, and the cause is always one key whose type moved.
      const first = parsed.error.issues[0];
      rejected.push({
        file: f,
        why: first ? `${first.path.join(".")}: ${first.message}` : "did not parse",
      });
      continue;
    }
    runs.push(parsed.data);
    raw_.set(parsed.data.run_id, raw);
  }
  runs.sort((a, b) => (a.run_id < b.run_id ? -1 : a.run_id > b.run_id ? 1 : 0));
  return { runs, raw: raw_, rejected, stale };
}

/** Bodies are trimmed for display; the full capture stays in results/exemplars on main. */
export const BODY_LIMIT = 700;

/** One request/response pair per endpoint per target, captured by the conformance gate. */
export function loadExemplars(dir: string): Record<string, WireDoc> {
  const out: Record<string, WireDoc> = {};
  for (const f of jsonFiles(dir)) {
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(f, "utf8"));
    } catch {
      continue;
    }
    const parsed = Capture.safeParse(raw);
    if (!parsed.success) continue;
    const doc = parsed.data;
    const endpoints: WireDoc["endpoints"] = {};
    for (const e of doc.endpoints) {
      const req = e.request;
      const res = e.response;
      endpoints[e.endpoint] = {
        family: e.family ?? "",
        m: req.method,
        p: req.path,
        rh: req.headers,
        rb: (req.body ?? "").slice(0, BODY_LIMIT),
        rbz: req.body_bytes ?? 0,
        s: res.status,
        sh: res.headers,
        shz: res.header_bytes,
        sbz: res.body_bytes,
        fr: res.framing ?? "",
        sb: res.body.slice(0, BODY_LIMIT),
        tr: Boolean(res.truncated) || res.body.length > BODY_LIMIT,
      };
    }
    // <language>-<target>@<host>
    out[path.basename(f, ".json")] = {
      framework: doc.framework ?? "",
      version: doc.version ?? "",
      adapter: doc.adapter ?? "",
      serializer: doc.serializer ?? "",
      endpoints,
    };
  }
  return out;
}

/**
 * Exemplars whose endpoint ids match nothing any run measured.
 *
 * Such a capture shows an empty payload pane with nothing on the page to say why, which is
 * how blend-v1 captures survived the move to blend-v2 unnoticed.
 */
export function staleExemplars(runs: Run[], wire: Record<string, WireDoc>): string[] {
  const known = new Set(runs.filter((r) => r.tracked).flatMap((r) => r.endpoint_order ?? []));
  if (!known.size) return [];
  return Object.entries(wire)
    .filter(([, v]) => !Object.keys(v.endpoints).some((eid) => known.has(eid)))
    .map(([k]) => k)
    .sort();
}
