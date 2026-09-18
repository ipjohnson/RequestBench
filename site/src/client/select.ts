// Turning a run into the rows on screen: which rate, which slice, which order.
//
// All of it pure, so what the table shows can be tested rather than looked at. The DOM half
// is in explorer.ts and does nothing but write what these return.
import { deltaFor } from "../lib/delta.js";
import type { FamilyRecord, Route, Run, Target, WireDoc } from "../lib/types.js";
import { COLS, type Gran, type Row, type State } from "./state.js";

const COLS_BY_ID = Object.fromEntries(COLS.map((c) => [c.id, c]));

export const rungsOf = (run: Run | null): string[] => (run ? run.rungs.map(String) : []);

/**
 * A serial run has no offered rate: it replays a pinned order one at a time, so the control
 * names the suite rather than a rate that does not exist.
 */
export const isSerial = (run: Run | null): boolean => Boolean(run?.suite?.startsWith("serial"));

export function rateLabel(run: Run, rn: string): string {
  if (isSerial(run)) return "serial, one at a time";
  for (const t of run.targets) {
    const d = t.rungs[rn];
    if (d) return `${(d.offered_rps ?? 0).toLocaleString()} rps`;
  }
  return rn;
}

/** The selected rate if this run has it, else the highest nobody saturated. */
export function pickRung(run: Run | null, want: string | null): string | null {
  if (!run) return null;
  const rs = rungsOf(run);
  if (want && rs.includes(want)) return want;
  const clean = rs.filter((rn) => !run.targets.some((t) => t.rungs[rn]?.saturated));
  return clean.length ? (clean[clean.length - 1] ?? null) : (rs[Math.floor(rs.length / 2)] ?? null);
}

/**
 * `families` is the middle rung's copy, kept for summaries written before the rung-keyed one
 * existed. Falling back to it per-rung would label mid-rung numbers as whatever rung is
 * selected, so it is used only when the rung-keyed map is absent altogether.
 */
export function famsAt(t: Target, rn: string): Record<string, FamilyRecord> {
  const byRung = t.families_by_rung;
  if (byRung && Object.keys(byRung).length) return byRung[rn] ?? {};
  return t.families ?? {};
}

const familyOf = (run: Run, eid: string): string =>
  run.targets.map((t) => t.endpoints?.[eid]?.family).find(Boolean) ?? eid.split(".")[0] ?? eid;

/**
 * The names the filter offers at a granularity: the run's families or its endpoint ids, in the
 * order the run lists them. A run from before per-endpoint detail has no order, and its
 * families are read off its targets at the rate on screen.
 */
export function choicesAt(run: Run | null, gran: Gran, rn: string | null): string[] {
  if (!run || gran === "blend") return [];
  const order = run.endpoint_order ?? [];
  if (gran === "endpoint") return order;
  const fams = order.length
    ? order.map((eid) => familyOf(run, eid))
    : run.targets.flatMap((t) => Object.keys(rn ? famsAt(t, rn) : {}));
  return [...new Set(fams)];
}

/**
 * The filter after the granularity changes to `gran`, so a family or endpoint view opens on
 * one family or endpoint rather than on every row of every target. An endpoint becomes its
 * family and a family its first endpoint. A filter that still matches is kept, which is how
 * "gin" stays every gin row. Anything else becomes the run's first name.
 */
export function filterFor(run: Run | null, gran: Gran, rn: string | null, q: string): string {
  if (!run || gran === "blend") return q;
  const order = run.endpoint_order ?? [];
  if (gran === "family" && order.includes(q)) return familyOf(run, q);
  const first = gran === "endpoint" ? order.find((eid) => familyOf(run, eid) === q) : undefined;
  if (first) return first;
  const names = choicesAt(run, gran, rn);
  const want = q.trim().toLowerCase();
  const hit = (s: string): boolean => s.toLowerCase().includes(want);
  if (want && (names.some(hit) || run.targets.some((t) => hit(t.target)))) return q;
  return names[0] ?? q;
}

const numberAt = (rec: Record<string, unknown> | undefined, metric: string): number | null => {
  const v = rec?.[metric];
  return typeof v === "number" ? v : null;
};

/**
 * Exemplars are keyed <language>-<target>@<host>: the same framework on two hosts puts
 * different things on the wire, which is the point of the host axis.
 */
export function wireKeyFor(
  language: string,
  target: string,
  host: string,
  index: Readonly<Record<string, unknown>>,
): string | null {
  const keyed = `${language}-${target}@${host}`;
  if (index[keyed]) return keyed;
  const bare = `${language}-${target}`;
  return index[bare] ? bare : null;
}

/** What this row put on the wire, merged to whatever granularity is on screen. */
export function wireFor(
  doc: WireDoc | null | undefined,
  gran: Gran,
  detail: string,
): Pick<Row, "hdrz" | "bodyz" | "framing" | "ex"> {
  if (!doc) return {};
  if (gran === "endpoint") {
    const e = doc.endpoints[detail];
    return e ? { hdrz: e.shz, bodyz: e.sbz, framing: e.fr, ex: e } : {};
  }
  const eps = Object.values(doc.endpoints).filter((e) => gran === "blend" || e.family === detail);
  if (!eps.length) return {};
  const frames = [...new Set(eps.map((e) => e.fr))];
  return {
    hdrz: eps.reduce((s, e) => s + e.shz, 0),
    bodyz: eps.reduce((s, e) => s + e.sbz, 0),
    framing: frames.length === 1 ? (frames[0] ?? "") : "mixed",
  };
}

export type RowsInput = {
  run: Run | null;
  st: State;
  routes: Record<string, Route | undefined>;
  wireOf: (language: string, target: string) => WireDoc | null | undefined;
};

export function rows({ run, st, routes, wireOf }: RowsInput): { rn: string | null; rows: Row[] } {
  if (!run) return { rn: null, rows: [] };
  const rn = pickRung(run, st.rung);
  if (!rn) return { rn: null, rows: [] };
  const out: Row[] = [];
  const q = st.q.trim().toLowerCase();

  for (const t of run.targets) {
    if (!st.langs.has(t.language)) continue;
    const doc = wireOf(t.language, t.target);
    const base = {
      target: t.target,
      language: t.language,
      version: t.version ?? "",
      adapter: t.adapter ?? "",
      serializer: t.serializer ?? "",
    };
    const push = (o: Omit<Row, keyof typeof base>): void => {
      const r: Row = { ...base, ...o };
      Object.assign(r, wireFor(doc, st.gran, r.detail));
      out.push(r);
    };

    if (st.gran === "blend") {
      const d = t.rungs[rn];
      if (!d) continue;
      push({
        key: `${t.language}:${t.target}`,
        label: t.target,
        detail: "",
        value: numberAt(d, st.metric),
        dead: !d.completed,
        n: d.achieved_rps ?? null,
      });
    } else if (st.gran === "family") {
      for (const [f, rec] of Object.entries(famsAt(t, rn))) {
        if (q && !f.toLowerCase().includes(q) && !t.target.toLowerCase().includes(q)) continue;
        push({
          key: `${t.language}:${t.target}|${f}`,
          label: t.target,
          detail: f,
          value: numberAt(rec, st.metric),
          dead: false,
          n: rec.count ?? null,
        });
      }
    } else {
      const eps = t.endpoints ?? {};
      const order = run.endpoint_order ?? [];
      if (!order.length || !Object.keys(eps).length) continue;
      for (const eid of order) {
        const rec = eps[eid];
        if (!rec) continue;
        const d = rec.rungs?.[rn];
        if (!d) continue;
        if (
          q &&
          !eid.toLowerCase().includes(q) &&
          !t.target.toLowerCase().includes(q) &&
          !(rec.family ?? "").toLowerCase().includes(q)
        )
          continue;
        push({
          key: `${t.language}:${t.target}|${eid}`,
          label: t.target,
          detail: eid,
          family: rec.family ?? "",
          value: numberAt(d, st.metric),
          dead: false,
          n: d.count ?? null,
          delta: deltaFor(t, eid, rn, routes, st.metric),
        });
      }
    }
  }

  return { rn, rows: sortRows(out, st) };
}

export function sortRows(rs: Row[], st: State): Row[] {
  const { col, dir } = st.sort;
  const spec = COLS_BY_ID[col];
  const get = (r: Row): number | string | null | undefined =>
    col === "name" ? r.label + r.detail
    : col === "lang" ? r.language
    : spec?.get ? spec.get(r)
    : (r as unknown as Record<string, number | string | null | undefined>)[col];
  return rs.sort((a, b) => {
    let x = get(a);
    let y = get(b);
    if (typeof x === "string" || typeof y === "string")
      return dir * String(x ?? "").localeCompare(String(y ?? ""));
    if (x == null) x = Infinity;
    if (y == null) y = Infinity;
    return dir * (x - y);
  });
}
