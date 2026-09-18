// What the explorer is showing, and the columns it can show it in.
//
// Every field here is carried in the URL hash, so a view is a link: the host, the rate, the
// metric, the granularity, the languages, the filter, the columns and the sort. A framework
// page opened from a row carries the same fields in its query, for its link back.
import type { Chain } from "../lib/delta.js";
import { isMetric, type MetricId } from "../lib/metrics.js";
import type { WireEndpoint } from "../lib/types.js";

export type Gran = "blend" | "family" | "endpoint";
const isGran = (s: string): s is Gran => s === "blend" || s === "family" || s === "endpoint";

/** One line of the table: a target at whatever granularity is on screen. */
export type Row = {
  key: string;
  language: string;
  target: string;
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
  ex?: WireEndpoint;
};

export type Col = {
  id: string;
  label: string;
  def: boolean;
  cls?: string;
  pin?: boolean;
  gran?: Gran;
  /** Read from the target's wire capture, which is fetched only when a column needs it. */
  wire?: boolean;
  get?: (r: Row) => number | string | null | undefined;
};

/** The table shows the columns you pick. */
export const COLS: Col[] = [
  { id: "version", label: "version", def: true, cls: "sub", get: (r) => r.version || "—" },
  { id: "adapter", label: "adapter", def: false, cls: "sub", get: (r) => r.adapter || "—" },
  { id: "serializer", label: "serializer", def: false, cls: "sub", get: (r) => r.serializer || "—" },
  { id: "value", label: "", def: true, pin: true, get: (r) => r.value },
  // Only at endpoint granularity: a family and the blend are merges and have no base.
  // Sorting by it is the cross-framework view, which is what gzip costing actix-web 431 us
  // and gorilla-mux 3,325 us is only visible in.
  { id: "delta", label: "over base", def: true, gran: "endpoint", get: (r) => r.delta?.total ?? null },
  { id: "n", label: "samples", def: true, cls: "sub", get: (r) => r.n },
  { id: "hdrz", label: "header B", def: false, cls: "sub", wire: true, get: (r) => r.hdrz },
  { id: "bodyz", label: "body B", def: false, cls: "sub", wire: true, get: (r) => r.bodyz },
  { id: "framing", label: "framing", def: false, cls: "sub", wire: true, get: (r) => r.framing },
  { id: "bar", label: "", def: true, cls: "barcell" },
];

export const defaultCols = (): Set<string> =>
  new Set(COLS.filter((c) => c.def).map((c) => c.id));

export type State = {
  host: string;
  langs: Set<string>;
  rung: string | null;
  metric: MetricId;
  gran: Gran;
  sort: { col: string; dir: number };
  q: string;
  cols: Set<string>;
};

export const initialState = (host: string, langs: string[]): State => ({
  host,
  langs: new Set(langs),
  rung: null,
  metric: "p50_us",
  gran: "blend",
  sort: { col: "value", dir: 1 },
  q: "",
  cols: defaultCols(),
});

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
 * A row's framework page, opened on the family or endpoint the row is. The query carries the
 * view the row was in, so the page's link back returns to it; `data` rides along because the
 * page itself reads nothing from it.
 */
export function pageHref(
  page: string,
  detail: string,
  st: State,
  allLangs: string[],
  data: string | null,
): string {
  const p = viewParams(st, allLangs);
  if (data) p.set("data", data);
  return `${page}?${p.toString()}${detail ? `#${encodeURIComponent(detail)}` : ""}`;
}

/** The inverse of pageHref: the index, with the view back in its hash and `data` in its query. */
export function backHref(index: string, search: string): string {
  const p = new URLSearchParams(search);
  const data = p.get("data");
  p.delete("data");
  const view = p.toString();
  return `${index}${data ? `?${new URLSearchParams({ data }).toString()}` : ""}${view ? `#${view}` : ""}`;
}
