// Turning a run into the rows on screen: which rate, which slice, which order.
//
// All of it pure, so what the table shows can be tested rather than looked at. The DOM half
// is in explorer.ts and does nothing but write what these return.
import { deltaFor } from "../lib/delta.ts";
import { familyOf, famsAt, metaOf, rungsOf, testOrder } from "../lib/run.ts";
import type { Route, Run, WireDoc } from "../lib/types.ts";
import { COLS, type Gran, type Row, type State } from "./state.ts";

const COLS_BY_ID = Object.fromEntries(COLS.map((c) => [c.id, c]));

export function rateLabel(run: Run, rn: string): string {
  for (const f of run.frameworks) {
    const d = f.rungs[rn];
    if (d) return `${(d.rps ?? 0).toLocaleString()} rps`;
  }
  return rn;
}

/**
 * The selected rate if this run has it, else the first: the one every framework is expected
 * to complete, and where the ladder compares latency. A higher rate can open the table on rows
 * with no latency, one for each framework that could not sustain it.
 */
export function pickRung(run: Run | null, want: string | null): string | null {
  if (!run) return null;
  const rs = rungsOf(run);
  if (want && rs.includes(want)) return want;
  return rs[0] ?? null;
}

/**
 * The names the filter offers at a granularity: the run's families or its test ids, in the
 * order the run lists them.
 */
export function choicesAt(run: Run | null, gran: Gran, rn: string | null): string[] {
  if (!run || gran === "blend") return [];
  const order = testOrder(run);
  if (gran === "test") return order;
  const fams = order.length
    ? order.map((id) => familyOf(run, id))
    : run.frameworks.flatMap((f) => Object.keys(rn ? famsAt(f, rn) : {}));
  return [...new Set(fams)];
}

/**
 * The filter after the granularity changes to `gran`, so a family or test view opens on one
 * family or test rather than on every row of every framework. A test becomes its family and a
 * family its first test. A filter that still matches is kept, which is how "carter" stays
 * every carter row. Anything else becomes the run's first name.
 */
export function filterFor(run: Run | null, gran: Gran, rn: string | null, q: string): string {
  if (!run || gran === "blend") return q;
  const order = testOrder(run);
  if (gran === "family" && order.includes(q)) return familyOf(run, q);
  const first = gran === "test" ? order.find((id) => familyOf(run, id) === q) : undefined;
  if (first) return first;
  const names = choicesAt(run, gran, rn);
  const want = q.trim().toLowerCase();
  const hit = (s: string): boolean => s.toLowerCase().includes(want);
  if (want && (names.some(hit) || run.frameworks.some((f) => hit(f.name)))) return q;
  return names[0] ?? q;
}

const numberAt = (rec: Record<string, unknown> | undefined, metric: string): number | null => {
  const v = rec?.[metric];
  return typeof v === "number" ? v : null;
};

/**
 * Exemplars are keyed <language>-<name>@<host>: the same framework on two hosts puts different
 * things on the wire, which is the point of the host axis.
 */
export function wireKeyFor(language: string, name: string, host: string, index: Readonly<Record<string, unknown>>): string | null {
  const key = `${language}-${name}@${host}`;
  return index[key] ? key : null;
}

/** What this row put on the wire, merged to whatever granularity is on screen. */
export function wireFor(doc: WireDoc | null | undefined, gran: Gran, detail: string): Pick<Row, "hdrz" | "bodyz" | "framing" | "ex"> {
  if (!doc) return {};
  if (gran === "test") {
    const e = doc.tests[detail];
    return e ? { hdrz: e.shz, bodyz: e.sbz, framing: e.fr, ex: e } : {};
  }
  const exs = Object.values(doc.tests).filter((e) => gran === "blend" || e.family === detail);
  if (!exs.length) return {};
  const frames = [...new Set(exs.map((e) => e.fr))];
  return {
    hdrz: exs.reduce((s, e) => s + e.shz, 0),
    bodyz: exs.reduce((s, e) => s + e.sbz, 0),
    framing: frames.length === 1 ? (frames[0] ?? "") : "mixed",
  };
}

export type RowsInput = {
  run: Run | null;
  st: State;
  routes: Record<string, Route | undefined>;
  wireOf: (language: string, name: string) => WireDoc | null | undefined;
};

export function rows({ run, st, routes, wireOf }: RowsInput): { rn: string | null; rows: Row[] } {
  if (!run) return { rn: null, rows: [] };
  const rn = pickRung(run, st.rung);
  if (!rn) return { rn: null, rows: [] };
  const out: Row[] = [];
  const q = st.q.trim().toLowerCase();
  const order = testOrder(run);

  for (const f of run.frameworks) {
    if (!st.langs.has(f.language)) continue;
    const doc = wireOf(f.language, f.name);
    const base = {
      id: f.id,
      language: f.language,
      name: f.name,
      version: f.version ?? "",
      adapter: metaOf(f, "adapter"),
      serializer: metaOf(f, "serializer"),
    };
    const push = (o: Omit<Row, keyof typeof base>): void => {
      const r: Row = { ...base, ...o };
      Object.assign(r, wireFor(doc, st.gran, r.detail));
      out.push(r);
    };

    if (st.gran === "blend") {
      const d = f.rungs[rn];
      if (!d) continue;
      push({
        key: f.id,
        label: f.name,
        detail: "",
        value: numberAt(d, st.metric),
        dead: !d.completed,
        n: d.achievedRps ?? null,
      });
    } else if (st.gran === "family") {
      for (const [fam, rec] of Object.entries(famsAt(f, rn))) {
        if (q && !fam.toLowerCase().includes(q) && !f.name.toLowerCase().includes(q)) continue;
        push({
          key: `${f.id}|${fam}`,
          label: f.name,
          detail: fam,
          value: numberAt(rec, st.metric),
          dead: false,
          n: rec.count ?? null,
        });
      }
    } else {
      for (const id of order) {
        const rec = f.tests?.[id];
        const d = rec?.rungs?.[rn];
        if (!rec || !d) continue;
        if (q && !id.toLowerCase().includes(q) && !f.name.toLowerCase().includes(q) && !(rec.family ?? "").toLowerCase().includes(q))
          continue;
        push({
          key: `${f.id}|${id}`,
          label: f.name,
          detail: id,
          family: rec.family ?? "",
          value: numberAt(d, st.metric),
          dead: false,
          n: d.count ?? null,
          delta: deltaFor(f, id, rn, routes, st.metric),
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
    if (typeof x === "string" || typeof y === "string") return dir * String(x ?? "").localeCompare(String(y ?? ""));
    if (x == null) x = Infinity;
    if (y == null) y = Infinity;
    return dir * (x - y);
  });
}
