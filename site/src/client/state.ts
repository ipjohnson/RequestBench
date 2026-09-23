// What the explorer is showing, and the columns it can show it in.
//
// Every field here is carried in the URL hash, so a view is a link: the host, the rate, the
// metric, the granularity, the languages, the filter, a custom blend's picks, the columns and the
// sort. A framework page opened from a row carries the same fields in its query, for its link back.
import { blendNamed, type BlendId, type CustomBlend } from "../lib/blends.ts";
import type { Chain } from "../lib/delta.ts";
import { isMetric, type MetricId } from "../lib/metrics.ts";
import type { WireExchange } from "../lib/types.ts";

export type Gran = "blend" | "family" | "test";
const isGran = (s: string): s is Gran => s === "blend" || s === "family" || s === "test";

/** One line of the table: a framework at whatever granularity is on screen. */
export type Row = {
  key: string;
  /** `dotnet:carter`. */
  id: string;
  language: string;
  name: string;
  label: string;
  detail: string;
  version: string;
  adapter: string;
  serializer: string;
  value: number | null;
  dead: boolean;
  n: number | null;
  family?: string;
  delta?: Chain | null;
  hdrz?: number;
  bodyz?: number;
  framing?: string;
  ex?: WireExchange;
};

export type Col = {
  id: string;
  label: string;
  def: boolean;
  cls?: string;
  pin?: boolean;
  gran?: Gran;
  /** Read from the framework's wire capture, which is fetched only when a column needs it. */
  wire?: boolean;
  get?: (r: Row) => number | string | null | undefined;
};

/** The table shows the columns you pick. */
export const COLS: Col[] = [
  { id: "version", label: "version", def: true, cls: "sub", get: (r) => r.version || "—" },
  { id: "adapter", label: "adapter", def: false, cls: "sub", get: (r) => r.adapter || "—" },
  { id: "serializer", label: "serializer", def: false, cls: "sub", get: (r) => r.serializer || "—" },
  { id: "value", label: "", def: true, pin: true, get: (r) => r.value },
  // Only at test granularity: a family and the blend are merges and have no base. Sorting by
  // it is the cross-framework view, which is where what gzip costs each framework shows.
  { id: "delta", label: "over base", def: true, gran: "test", get: (r) => r.delta?.total ?? null },
  { id: "n", label: "samples", def: true, cls: "sub", get: (r) => r.n },
  { id: "hdrz", label: "header B", def: false, cls: "sub", wire: true, get: (r) => r.hdrz },
  { id: "bodyz", label: "body B", def: false, cls: "sub", wire: true, get: (r) => r.bodyz },
  { id: "framing", label: "framing", def: false, cls: "sub", wire: true, get: (r) => r.framing },
  { id: "bar", label: "", def: true, cls: "barcell" },
];

export const defaultCols = (): Set<string> => new Set(COLS.filter((c) => c.def).map((c) => c.id));

export type State = {
  host: string;
  langs: Set<string>;
  rung: string | null;
  metric: MetricId;
  gran: Gran;
  /** Kept when another blend is chosen, so going back to custom finds it as it was left. */
  pick: CustomBlend;
  sort: { col: string; dir: number };
  q: string;
  cols: Set<string>;
};

export const initialState = (host: string, langs: string[]): State => ({
  host,
  langs: new Set(langs),
  rung: null,
  metric: "p50Us",
  gran: "blend",
  pick: { entries: [], weights: {} },
  sort: { col: "value", dir: 1 },
  q: "",
  cols: defaultCols(),
});

/**
 * The blend on screen. At blend granularity the filter names one, as it names a family or a test
 * at theirs, and a filter that names none is a framework's name read over All.
 */
export const blendIn = (st: State): BlendId => (st.gran === "blend" ? (blendNamed(st.q) ?? "all") : "all");

export function readHash(st: State, hash: string): void {
  const p = new URLSearchParams(hash.slice(1));
  const host = p.get("host");
  if (host) st.host = host;
  const langs = p.get("langs");
  if (langs) st.langs = new Set(langs.split(","));
  const rung = p.get("rung");
  if (rung) st.rung = rung;
  const metric = p.get("metric");
  if (metric && isMetric(metric)) st.metric = metric;
  const gran = p.get("gran");
  if (gran && isGran(gran)) st.gran = gran;
  const pick = p.get("pick");
  if (pick) st.pick.entries = pick.split(",").filter(Boolean);
  const wt = p.get("wt");
  if (wt) {
    st.pick.weights = {};
    for (const pair of wt.split(",")) {
      const [fam, w] = pair.split(":");
      const n = Number(w);
      if (fam && w !== undefined && Number.isFinite(n) && n >= 0) st.pick.weights[fam] = n;
    }
  }
  const q = p.get("q");
  if (q) st.q = q;
  const cols = p.get("cols");
  if (cols) st.cols = new Set(cols.split(","));
  const sort = p.get("sort");
  if (sort) {
    const [col, dir] = sort.split(":");
    if (col) st.sort = { col, dir: Number(dir) || 1 };
  }
}

function viewParams(st: State, allLangs: string[]): URLSearchParams {
  const p = new URLSearchParams();
  p.set("host", st.host);
  p.set("metric", st.metric);
  p.set("gran", st.gran);
  if (st.pick.entries.length) p.set("pick", st.pick.entries.join(","));
  const wt = Object.entries(st.pick.weights).map(([fam, w]) => `${fam}:${w}`);
  if (wt.length) p.set("wt", wt.join(","));
  if (st.rung) p.set("rung", st.rung);
  if (st.langs.size !== allLangs.length) p.set("langs", [...st.langs].join(","));
  if (st.q) p.set("q", st.q);
  p.set("cols", [...st.cols].join(","));
  p.set("sort", `${st.sort.col}:${st.sort.dir}`);
  return p;
}

export function writeHash(st: State, allLangs: string[]): string {
  return `#${viewParams(st, allLangs).toString()}`;
}

/**
 * A row's framework page, opened on the family or test the row is. The query carries the view
 * the row was in, so the page's link back returns to it; `data` rides along because the page
 * itself reads nothing from it.
 */
export function pageHref(page: string, detail: string, st: State, allLangs: string[], data: string | null): string {
  const p = viewParams(st, allLangs);
  if (data) p.set("data", data);
  return `${page}?${p.toString()}${detail ? `#${encodeURIComponent(detail)}` : ""}`;
}

/**
 * The inverse of pageHref: the index, with the view back in its hash and `data` in its query.
 * `vs` is what the framework page is compared with, which is that page's and not the view's.
 */
export function backHref(index: string, search: string): string {
  const p = new URLSearchParams(search);
  const data = p.get("data");
  p.delete("data");
  p.delete("vs");
  const view = p.toString();
  return `${index}${data ? `?${new URLSearchParams({ data }).toString()}` : ""}${view ? `#${view}` : ""}`;
}
