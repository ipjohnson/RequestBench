// What the endpoints are, straight from spec/, rather than restated here.
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./config.js";
import type { HostNote, Project, Route } from "./types.js";

function readJson(rel: string): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export const readSpec = (): Record<string, unknown> => readJson("spec/endpoints.json");

/**
 * Method, route and base edge per endpoint id, for a framework page's endpoints and the
 * explorer's delta column.
 *
 * The summary carries ids and families but never the route, and an id alone does not say
 * what was asked for. Forty-five short strings, so they ride in the page rather than being
 * fetched.
 *
 * `b` and `v` are the base and the factor varied from it. They come from the spec rather
 * than the run because a run records what was measured and never why two endpoints are a
 * pair, and a delta that named the wrong pair would be wrong in a way no number shows. A run
 * older than the current spec loses its deltas, which is correct: the pairing it was
 * measured under is not this one.
 */
type SpecEndpoint = {
  id: string;
  method?: string;
  path?: string;
  base?: string;
  varies?: string;
};

export function specRoutes(spec: Record<string, unknown>): Record<string, Route> {
  const out: Record<string, Route> = {};
  for (const e of (spec["endpoints"] as SpecEndpoint[] | undefined) ?? []) {
    const row: Route = { m: e.method ?? "", p: e.path ?? "" };
    if (e.base !== undefined && e.varies !== undefined) {
      row.b = e.base;
      row.v = e.varies;
    }
    out[e.id] = row;
  }
  return out;
}

/** What each factor reads as, so the delta is a sentence rather than two ids. */
export function specFactors(spec: Record<string, unknown>): Record<string, string> {
  const factors = (spec["factors"] as Record<string, { reads?: string }> | undefined) ?? {};
  return Object.fromEntries(Object.entries(factors).map(([k, v]) => [k, v.reads ?? ""]));
}

/**
 * Licence and links per target, keyed `language:target`.
 *
 * Declared rather than derived, which docs/bundles.html §5 argues against and is right to:
 * this goes stale silently the day a project moves. It is here so the page can say what a
 * framework is licensed under today, and it is the half §5 replaces.
 */
export function specProjects(): Record<string, Project> {
  return (readJson("spec/matrix.json")["projects"] as Record<string, Project> | undefined) ?? {};
}

/** What a host is, and what it should be compared against, straight from the spec. */
export function hostNotes(): Record<string, HostNote> {
  const hosts = (readJson("spec/matrix.json")["hosts"] as
    | Record<string, { note?: string; compare_to?: string }>
    | undefined) ?? {};
  return Object.fromEntries(
    Object.entries(hosts)
      .filter(([, cfg]) => cfg.note)
      .map(([h, cfg]) => [h, { note: cfg.note ?? "", compare_to: cfg.compare_to ?? "" }]),
  );
}
