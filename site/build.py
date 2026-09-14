"""Render the results explorer from committed summaries.

One self-contained page. The summaries are embedded, so it works from file:// and from
Pages identically, and every slice happens in the browser rather than at build time.

  python3 site/build.py --summaries results/summary --out site/dist
"""
import argparse, html, json, pathlib, sys, datetime as dt

T = {  # light, dark
    "ground": ("#F4F5F2", "#121513"), "surface": ("#FCFCFB", "#1A1E1B"),
    "surface2": ("#EDEFEA", "#232823"), "ink": ("#121917", "#E8ECE7"),
    "ink2": ("#58655F", "#9AA59E"), "ink3": ("#66716A", "#949E98"),
    "rule": ("#DCE0DB", "#2A302C"), "rule2": ("#C3C9C2", "#3A423C"),
    "teal": ("#00836E", "#35AD97"), "tealtext": ("#00705E", "#35AD97"),
    "amber": ("#A6670C", "#DDA03C"), "tealsoft": ("#DCEBE6", "#17302B"),
    "onfill": ("#FFFFFF", "#101614"), "bar": ("#DCEBE6", "#1D3B34"),
}
# Six-hue categorical set; both orders clear the validator's CVD, chroma and contrast
# checks on their own surface.
SERIES_LIGHT = ["#00836E", "#B5651D", "#3F6FB0", "#A03E5C", "#6B8E23", "#7D5BA6"]
SERIES_DARK = ["#2E9B85", "#C77A2A", "#5A85C4", "#C05A78", "#7FA03A", "#9478BE"]


def tokens(i):
    return "\n".join("  --%s: %s;" % (k, v[i]) for k, v in T.items())


def series_css(i, names):
    return "\n".join("  --s%d: %s;" % (n, c) for n, c in enumerate(names))


CSS = """
:root {
__TOK_L__
__SER_L__
  --f-display: "Newsreader", Georgia, serif;
  --f-body: "Archivo", "Helvetica Neue", Arial, sans-serif;
  --f-mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
__TOK_D__
__SER_D__
} }
:root[data-theme="dark"] {
__TOK_D__
__SER_D__
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--ground); color: var(--ink);
       font-family: var(--f-body); font-size: 15px; line-height: 1.55;
       -webkit-font-smoothing: antialiased; }
.page { max-width: 1240px; margin: 0 auto;
        padding-inline: clamp(16px, 4vw, 40px); padding-block: clamp(28px, 5vw, 52px) 48px; }
a { color: var(--tealtext); }
code, .mono { font-family: var(--f-mono); }

.eyebrow { font-family: var(--f-mono); font-size: 11px; letter-spacing: .13em;
           text-transform: uppercase; color: var(--tealtext); margin: 0 0 14px;
           display: flex; gap: 12px; align-items: center; }
.eyebrow::after { content: ""; flex: 1; height: 1px; background: var(--rule2); }
h1 { font-family: var(--f-display); font-weight: 600; letter-spacing: -.02em;
     font-size: clamp(30px, 5vw, 46px); line-height: 1.05; margin: 0 0 14px; }
.lede { font-family: var(--f-display); font-size: clamp(16px, 2vw, 19px);
        color: var(--ink2); max-width: 64ch; margin: 0; }

/* ---------- controls ---------- */
.controls { display: flex; flex-wrap: wrap; gap: 10px 14px; align-items: flex-end;
            margin: 28px 0 0; padding: 16px; background: var(--surface);
            border: 1px solid var(--rule); border-radius: 4px; }
.ctl { display: flex; flex-direction: column; gap: 5px; }
.ctl > label { font-family: var(--f-mono); font-size: 10px; letter-spacing: .1em;
               text-transform: uppercase; color: var(--ink3); }
select, input[type=search] {
  font: inherit; font-size: 14px; color: var(--ink); background: var(--ground);
  border: 1px solid var(--rule2); border-radius: 3px; padding: 6px 9px; min-width: 120px; }
input[type=search] { min-width: 190px; }
.seg { display: flex; border: 1px solid var(--rule2); border-radius: 3px; overflow: hidden; }
.seg button { font: inherit; font-size: 13px; padding: 6px 12px; cursor: pointer;
              background: var(--ground); color: var(--ink2); border: none;
              border-left: 1px solid var(--rule2); }
.seg button:first-child { border-left: none; }
.seg button[aria-pressed="true"] { background: var(--teal); color: var(--onfill); font-weight: 600; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { font: inherit; font-size: 12.5px; padding: 5px 11px; cursor: pointer;
        border: 1px solid var(--rule2); border-radius: 99px;
        background: var(--ground); color: var(--ink2); display: flex; align-items: center; gap: 6px; }
.chip[aria-pressed="true"] { border-color: transparent; color: var(--onfill); }
.chip i { width: 8px; height: 8px; border-radius: 99px; display: inline-block; }
.spacer { flex: 1 1 auto; }
.count { font-family: var(--f-mono); font-size: 12px; color: var(--ink3); }

/* ---------- table ---------- */
/* A 240-row endpoint view would push the chart off the page; cap it and let the
   sticky header carry the column names down the scroll. */
.scroll { overflow: auto; margin-top: 20px; max-height: 62vh;
          border: 1px solid var(--rule); border-radius: 4px; }
table { border-collapse: collapse; width: 100%; min-width: 760px; font-size: 14px;
        background: var(--ground); }
th, td { padding: 8px 11px; text-align: right; border-bottom: 1px solid var(--rule);
         font-variant-numeric: tabular-nums; white-space: nowrap; }
th:first-child, td:first-child, th.l, td.l { text-align: left; }
thead th { position: sticky; top: 0; z-index: 1; background: var(--surface2);
           font-family: var(--f-mono); font-size: 10px; letter-spacing: .09em;
           text-transform: uppercase; color: var(--ink3); font-weight: 500;
           border-bottom: 1px solid var(--rule2); cursor: pointer; user-select: none; }
thead th:hover { color: var(--ink); }
thead th[aria-sort] { color: var(--tealtext); }
thead th[aria-sort]::after { content: " \\25B4"; }
thead th[aria-sort="descending"]::after { content: " \\25BE"; }
tbody tr:hover { background: var(--surface); }
tbody tr[aria-selected="true"] { background: var(--tealsoft); }
td.rank { color: var(--ink3); font-family: var(--f-mono); font-size: 12px; width: 34px; }
td.name { font-weight: 600; }
td.name .swatch { width: 8px; height: 8px; border-radius: 2px; display: inline-block;
                  margin-right: 7px; vertical-align: middle; }
td.sub { color: var(--ink2); font-family: var(--f-mono); font-size: 12px; }
td.ratio { font-family: var(--f-mono); }
td.ratio.up { color: var(--amber); }
td.ratio.base { color: var(--ink3); }
td.dead { color: var(--ink3); text-decoration: line-through; }
.barcell { width: 26%; min-width: 120px; }
.bar { height: 9px; border-radius: 2px; background: var(--teal); min-width: 2px; }
.bar.b { background: var(--bar); }
.pill { display: inline-block; font-family: var(--f-mono); font-size: 10.5px;
        padding: 1px 6px; border-radius: 2px; background: var(--tealsoft);
        color: var(--tealtext); margin-left: 7px; }

/* ---------- charts ---------- */
.panel { background: var(--surface); border: 1px solid var(--rule); border-radius: 4px;
         padding: 18px; margin-top: 26px; }
.panel h2 { font-family: var(--f-display); font-size: 20px; font-weight: 600;
            margin: 0 0 4px; letter-spacing: -.01em; }
.panel p.hint { margin: 0 0 14px; font-size: 13px; color: var(--ink2); }
.legend { display: flex; flex-wrap: wrap; gap: 7px 16px; margin-top: 13px;
          font-size: 12px; color: var(--ink2); }
.legend span { display: flex; align-items: center; gap: 6px; }
.legend b { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
.empty { color: var(--ink3); font-size: 13px; padding: 22px 0; text-align: center; }
.chip.sm { font-size: 11.5px; padding: 4px 9px; }
/* Language chips carry an inline background; column chips need their own, or the
   pressed state sets onfill text on the unchanged ground and the label vanishes. */
.chip.sm[aria-pressed="true"] { background: var(--teal); border-color: var(--teal); }
tbody tr { cursor: pointer; }
dialog#dlg { border: 1px solid var(--rule2); border-radius: 5px; background: var(--surface);
             color: var(--ink); padding: 0; max-width: min(1040px, 94vw); width: 100%;
             max-height: 88vh; }
dialog#dlg::backdrop { background: rgba(0, 0, 0, .5); }
#dlgbody { padding: 22px clamp(16px, 3vw, 28px) 26px; overflow-y: auto; max-height: 88vh; }
#dlgclose { position: absolute; top: 10px; right: 12px; z-index: 2; font-size: 22px;
            line-height: 1; padding: 2px 9px 5px; cursor: pointer; border-radius: 3px;
            border: 1px solid var(--rule2); background: var(--ground); color: var(--ink2); }
#dlgclose:hover { border-color: var(--teal); color: var(--tealtext); }
.fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 1px; background: var(--rule); border: 1px solid var(--rule);
          border-radius: 3px; margin-bottom: 20px; }
.frow { background: var(--surface); padding: 9px 12px; display: flex;
        flex-direction: column; gap: 3px; }
.frow.hid { background: var(--surface2); }
.fk { font-family: var(--f-mono); font-size: 10px; letter-spacing: .08em;
      text-transform: uppercase; color: var(--ink3); }
.fk em { font-style: normal; color: var(--amber); }
.fv { font-family: var(--f-mono); font-size: 14px; font-variant-numeric: tabular-nums; }
.wirebtn[aria-pressed="true"] { background: var(--teal); border-color: var(--teal);
                                color: var(--onfill); }
.wirehead { display: flex; flex-wrap: wrap; gap: 9px; align-items: baseline;
            margin-bottom: 14px; font-size: 14px; }
.wirehead .wmeta { font-family: var(--f-mono); font-size: 11.5px; color: var(--ink3);
                   margin-left: auto; }
.wirecols { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
@media (max-width: 780px) { .wirecols { grid-template-columns: 1fr; } }
.wirecols h3 { font-family: var(--f-mono); font-size: 10px; letter-spacing: .1em;
               text-transform: uppercase; color: var(--ink3); margin: 0 0 8px; font-weight: 500; }
pre.wire { font-family: var(--f-mono); font-size: 12px; line-height: 1.6; margin: 0 0 10px;
           padding: 9px 11px; background: var(--ground); border: 1px solid var(--rule);
           border-radius: 3px; overflow-x: auto; white-space: pre-wrap; word-break: break-all;
           color: var(--ink); }
pre.wire.req { border-left: 2px solid var(--teal); }
pre.wire.res { border-left: 2px solid var(--amber); }
.hdrs { margin: 0 0 10px; }
.hrow { display: grid; grid-template-columns: minmax(110px, 34%) 1fr; gap: 10px;
        font-family: var(--f-mono); font-size: 11.5px; padding: 3px 0;
        border-bottom: 1px solid var(--rule); }
.hrow:last-child { border-bottom: none; }
.hk { color: var(--tealtext); }
.hv { color: var(--ink2); word-break: break-all; }
.note { border-left: 2px solid var(--amber); background: var(--surface);
        padding: 13px 17px; border-radius: 0 3px 3px 0; margin-top: 22px;
        font-size: 13.5px; color: var(--ink2); }
footer { margin-top: 52px; border-top: 1px solid var(--rule2); padding-top: 16px;
         font-family: var(--f-mono); font-size: 11px; color: var(--ink3);
         display: flex; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
:focus-visible { outline: 2px solid var(--teal); outline-offset: 2px; }
@media (max-width: 620px) { .controls { padding: 12px; } .barcell { display: none; } }
"""
# Placeholders rather than %-formatting: CSS is full of bare % (widths, viewport units),
# and every one of them had to be doubled or the build died at a distance.
CSS = (CSS.replace("__TOK_L__", tokens(0)).replace("__SER_L__", series_css(0, SERIES_LIGHT))
          .replace("__TOK_D__", tokens(1)).replace("__SER_D__", series_css(1, SERIES_DARK)))


def esc(s):
    return html.escape(str(s))


def load_exemplars(d):
    """One request/response pair per endpoint per target, captured by the conformance gate.

    Bodies are trimmed for display; the full capture stays in results/exemplars on main.
    """
    out = {}
    for f in sorted(pathlib.Path(d).glob("*.json")):
        key = f.stem                      # <shard>-<target>
        try:
            doc = json.loads(f.read_text())
        except json.JSONDecodeError:
            continue
        eps = {}
        for e in doc.get("endpoints", []):
            req, res = e["request"], e["response"]
            eps[e["endpoint"]] = {
                "m": req["method"], "p": req["path"],
                "rh": req["headers"], "rb": (req.get("body") or "")[:700],
                "rbz": req.get("body_bytes", 0),
                "s": res["status"], "sh": res["headers"],
                "shz": res["header_bytes"], "sbz": res["body_bytes"],
                "fr": res.get("framing", ""),
                "sb": res["body"][:700], "tr": res.get("truncated") or len(res["body"]) > 700,
            }
        out[key] = {"framework": doc.get("framework", ""), "version": doc.get("version", ""),
                    "endpoints": eps}
    return out


def load(d):
    runs = []
    for f in sorted(pathlib.Path(d).glob("*.json")):
        if f.name.startswith("."):
            continue
        try:
            runs.append(json.loads(f.read_text()))
        except json.JSONDecodeError:
            print("  skipping unreadable %s" % f, file=sys.stderr)
    runs.sort(key=lambda r: r["run_id"])
    return runs


APP = r"""
const RB = window.__RB__;
const S = {light: __SERIES_LIGHT__, dark: __SERIES_DARK__};
const ser = () => (matchMedia('(prefers-color-scheme: dark)').matches &&
                   document.documentElement.dataset.theme !== 'light') ||
                  document.documentElement.dataset.theme === 'dark' ? S.dark : S.light;

const tracked = RB.runs.filter(r => r.tracked);
const hosts   = [...new Set(tracked.map(r => r.exec_host || 'container'))].sort();
const langs   = [...new Set(tracked.flatMap(r => r.targets.map(t => t.shard)))].sort();

const METRICS = {
  p50_us: {label: 'p50', unit: 'us'}, p90_us: {label: 'p90', unit: 'us'},
  p99_us: {label: 'p99', unit: 'us'}, p999_us: {label: 'p99.9', unit: 'us'},
  p50_ratio: {label: 'p50 vs baseline', unit: 'x'},
  p99_ratio: {label: 'p99 vs baseline', unit: 'x'},
  achieved_rps: {label: 'achieved rps', unit: ''}, dropped: {label: 'dropped', unit: ''},
};

/* The table shows the columns you pick. Everything else still exists and shows up in the
   detail dialog, so hiding a column narrows the view without losing the number. */
const COLS = [
  {id: 'version', label: 'version',     def: true,  cls: 'sub',   get: r => r.version || '\u2014'},
  {id: 'value',   label: '',            def: true,  pin: true,    get: r => r.value},
  {id: 'ratio',   label: 'vs baseline', def: true,  cls: 'ratio', get: r => r.ratio},
  {id: 'n',       label: 'samples',     def: true,  cls: 'sub',   get: r => r.n},
  {id: 'hdrz',    label: 'header B',    def: false, cls: 'sub',   get: r => r.hdrz},
  {id: 'bodyz',   label: 'body B',      def: false, cls: 'sub',   get: r => r.bodyz},
  {id: 'framing', label: 'framing',     def: false, cls: 'sub',   get: r => r.framing, text: true},
  {id: 'bar',     label: '',            def: true,  cls: 'barcell'},
];

const st = {
  host: hosts[0] || 'container', langs: new Set(langs),
  rung: null, metric: 'p50_us', gran: 'blend',
  sort: {col: 'value', dir: 1}, q: '',
  cols: new Set(COLS.filter(c => c.def).map(c => c.id)),
};

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  if (p.get('host')) st.host = p.get('host');
  if (p.get('langs')) st.langs = new Set(p.get('langs').split(','));
  if (p.get('rung')) st.rung = p.get('rung');
  if (p.get('metric')) st.metric = p.get('metric');
  if (p.get('gran')) st.gran = p.get('gran');
  if (p.get('q')) st.q = p.get('q');
  if (p.get('cols')) st.cols = new Set(p.get('cols').split(','));
  if (p.get('sort')) { const [c, d] = p.get('sort').split(':'); st.sort = {col: c, dir: +d}; }
}
let writeHash = function () {
  const p = new URLSearchParams();
  p.set('host', st.host); p.set('metric', st.metric); p.set('gran', st.gran);
  if (st.rung) p.set('rung', st.rung);
  if (st.langs.size !== langs.length) p.set('langs', [...st.langs].join(','));
  if (st.q) p.set('q', st.q);
  p.set('cols', [...st.cols].join(','));
  p.set('sort', st.sort.col + ':' + st.sort.dir);
  history.replaceState(null, '', '#' + p.toString());
};

const runsForHost = () => tracked.filter(r => (r.exec_host || 'container') === st.host);
const latest = () => { const rs = runsForHost(); return rs.length ? rs[rs.length - 1] : null; };
const rungsOf = run => run ? run.rungs.map(String) : [];
function pickRung(run) {
  if (!run) return null;
  const rs = rungsOf(run);
  if (st.rung && rs.includes(st.rung)) return st.rung;
  const clean = rs.filter(rn => !run.targets.some(t => (t.rungs[rn] || {}).baseline_saturated));
  return clean.length ? clean[clean.length - 1] : rs[Math.floor(rs.length / 2)];
}
const offered = (run, rn) => {
  for (const t of run.targets) if (t.rungs[rn]) return t.rungs[rn].offered_rps;
  return rn;
};
const esc = t => String(t).replace(/[&<>"]/g, c =>
  ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

/* ---- wire data, aggregated to whatever granularity is on screen ---- */
/* Exemplars are keyed <shard>-<target>@<host>: the same framework on two hosts puts
   different things on the wire, which is the point of the host axis. */
const wireDoc = r => {
  const w = RB.wire || {}, run = latest();
  const host = (run && run.exec_host) || 'container';
  return w[`${r.shard}-${r.target}@${host}`] || w[`${r.shard}-${r.target}`];
};
function wireFor(r) {
  const doc = wireDoc(r);
  if (!doc) return {};
  if (st.gran === 'endpoint') {
    const e = doc.endpoints[r.detail];
    return e ? {hdrz: e.shz, bodyz: e.sbz, framing: e.fr, ex: e} : {};
  }
  const eps = Object.entries(doc.endpoints)
    .filter(([, e]) => st.gran === 'blend' || e.family === r.detail);
  if (!eps.length) return {};
  const frames = [...new Set(eps.map(([, e]) => e.fr))];
  return {
    hdrz: eps.reduce((s, [, e]) => s + e.shz, 0),
    bodyz: eps.reduce((s, [, e]) => s + e.sbz, 0),
    framing: frames.length === 1 ? frames[0] : 'mixed',
  };
}

function rows() {
  const run = latest(); if (!run) return {run: null, rn: null, rows: []};
  const rn = pickRung(run);
  const out = [];
  const q = st.q.trim().toLowerCase();
  for (const t of run.targets) {
    if (!st.langs.has(t.shard)) continue;
    const isBase = t.target === t.baseline;
    const base = {target: t.target, shard: t.shard, version: t.version || '',
                  isBase, key: t.shard + ':' + t.target};
    const push = o => { const r = {...base, ...o}; Object.assign(r, wireFor(r)); out.push(r); };
    if (st.gran === 'blend') {
      const d = t.rungs[rn]; if (!d) continue;
      push({label: t.target, detail: '', value: d[st.metric] ?? null,
            ratio: d.p50_ratio, dead: !!d.baseline_saturated, n: d.achieved_rps});
    } else if (st.gran === 'family') {
      const fams = (t.families_by_rung || {})[rn] || t.families || {};
      for (const [f, rec] of Object.entries(fams)) {
        if (q && !(f.toLowerCase().includes(q) || t.target.toLowerCase().includes(q))) continue;
        push({key: base.key + '|' + f, label: t.target, detail: f,
              value: rec[st.metric] ?? null, ratio: rec.p50_ratio, dead: false, n: rec.count});
      }
    } else {
      const eps = t.endpoints || {}, order = run.endpoint_order || [],
            fam = run.endpoint_family || [];
      if (!order.length || !Object.keys(eps).length) continue;
      const arr = k => (eps[k] && eps[k][rn]) || [];
      const p50s = arr('p50_us'), vals = arr(st.metric), cnt = arr('count'),
            rats = arr('p50_ratio');
      order.forEach((eid, i) => {
        if (q && !(eid.toLowerCase().includes(q) || t.target.toLowerCase().includes(q) ||
                   (fam[i] || '').toLowerCase().includes(q))) return;
        if (p50s[i] == null) return;
        push({key: base.key + '|' + eid, label: t.target, detail: eid, family: fam[i],
              value: vals[i] ?? null, ratio: rats[i], dead: false, n: cnt[i]});
      });
    }
  }
  const {col, dir} = st.sort;
  const spec = COLS.find(c => c.id === col);
  const get = r => col === 'name' ? (r.label + r.detail)
                 : col === 'lang' ? r.shard
                 : spec ? spec.get(r) : r[col];
  out.sort((a, b) => {
    let x = get(a), y = get(b);
    if (typeof x === 'string' || typeof y === 'string')
      return dir * String(x ?? '').localeCompare(String(y ?? ''));
    if (x == null) x = Infinity; if (y == null) y = Infinity;
    return dir * (x - y);
  });
  return {run, rn, rows: out};
}

const unit = id => id === 'value' ? METRICS[st.metric].unit
  : id === 'ratio' ? 'x' : (id === 'hdrz' || id === 'bodyz') ? 'B' : '';
function cell(id, v) {
  if (v == null) return '&mdash;';
  if (typeof v === 'string') return esc(v);
  const u = unit(id);
  return u === 'x' ? v.toFixed(2) + 'x'
       : u === 'us' ? Math.round(v).toLocaleString() + ' us'
       : u === 'B' ? Math.round(v).toLocaleString() + ' B'
       : Math.round(v).toLocaleString();
}
const fmt = v => cell('value', v);

function emptyWhy(run) {
  if (st.gran === 'endpoint' && !(run.endpoint_order || []).length)
    return 'This run predates per-endpoint detail, so it can only be read at blend or family level.';
  return 'Nothing matches those filters.';
}

/* ---- render ---- */
function visibleCols() { return COLS.filter(c => c.pin || st.cols.has(c.id)); }

function render() {
  const {run, rn, rows: rs} = rows();
  const cols = ser();
  const langColour = Object.fromEntries(langs.map((l, i) => [l, cols[i % cols.length]]));

  document.getElementById('host').innerHTML =
      hosts.map(h => `<option${h === st.host ? ' selected' : ''}>${h}</option>`).join('');
  document.getElementById('rung').innerHTML = run ? rungsOf(run).map(r =>
      `<option value="${r}"${r === rn ? ' selected' : ''}>${offered(run, r).toLocaleString()} rps</option>`).join('') : '';
  document.getElementById('metric').value = st.metric;
  document.querySelectorAll('.seg button[data-gran]').forEach(b =>
      b.setAttribute('aria-pressed', b.dataset.gran === st.gran));
  document.getElementById('chips').innerHTML = langs.map(l =>
      `<button class="chip" data-lang="${l}" aria-pressed="${st.langs.has(l)}"` +
      `${st.langs.has(l) ? ` style="background:${langColour[l]}"` : ''}>` +
      `<i style="background:${st.langs.has(l) ? 'currentColor' : langColour[l]}"></i>${l}</button>`).join('');
  document.getElementById('colchips').innerHTML = COLS.filter(c => !c.pin && c.label).map(c =>
      `<button class="chip sm" data-col="${c.id}" aria-pressed="${st.cols.has(c.id)}">${c.label}</button>`).join('');
  document.getElementById('q').value = st.q;
  for (const id of ['q', 'qlabel'])
    document.getElementById(id).style.display = st.gran === 'blend' ? 'none' : '';

  if (!run) {
    document.getElementById('meta').textContent = 'no tracked runs for this host yet';
    document.getElementById('thead').innerHTML = '';
    document.getElementById('tbody').innerHTML = '';
    document.getElementById('time').innerHTML = '<p class="empty">No data.</p>';
    writeHash(); return;
  }
  document.getElementById('meta').textContent =
      `${run.date} \u00b7 ${run.cpu}, ${run.cores} cores \u00b7 ${rs.length} rows \u00b7 click a row for detail`;

  const vc = visibleCols();
  const label = c => c.id === 'value' ? METRICS[st.metric].label : c.label;
  document.getElementById('thead').innerHTML =
    `<tr><th style="cursor:default">#</th><th class="l" data-col="name">framework</th>` +
    `<th class="l" data-col="lang">slice</th>` +
    vc.map(c => c.label || c.id === 'value'
        ? `<th class="${c.cls === 'barcell' ? 'barcell' : ''}" data-col="${c.id}"${st.sort.col === c.id ? ` aria-sort="${st.sort.dir === 1 ? 'ascending' : 'descending'}"` : ''}>${esc(label(c))}</th>`
        : `<th class="barcell" style="cursor:default"></th>`).join('') + `</tr>`;

  const finite = rs.map(r => r.value).filter(v => v != null && isFinite(v));
  const worst = finite.length ? Math.max(...finite) : 1;
  document.getElementById('tbody').innerHTML = rs.map((r, i) => {
    const w = r.value != null && isFinite(r.value) ? Math.max(1.5, 100 * r.value / worst) : 0;
    const tds = vc.map(c => {
      if (c.id === 'bar')
        return `<td class="barcell"><div class="bar${r.isBase ? ' b' : ''}" style="width:${w}%;background:${r.isBase ? '' : langColour[r.shard]}"></div></td>`;
      const v = c.get(r);
      const extra = c.id === 'value' && r.dead ? ' dead'
                  : c.id === 'ratio' ? (r.isBase ? ' base' : (v > 1.15 ? ' up' : '')) : '';
      return `<td class="${c.cls || ''}${extra}">${cell(c.id, v)}</td>`;
    }).join('');
    return `<tr data-key="${esc(r.key)}" tabindex="0">
      <td class="rank">${i + 1}</td>
      <td class="name l"><span class="swatch" style="background:${langColour[r.shard]}"></span>${esc(r.label)}${r.isBase ? '<span class="pill">baseline</span>' : ''}</td>
      <td class="sub l">${esc(r.detail || r.shard)}</td>${tds}</tr>`;
  }).join('') || `<tr><td colspan="${vc.length + 3}" class="empty">${emptyWhy(run)}</td></tr>`;
  document.getElementById('count').textContent = `${rs.length} rows`;

  window.__rows = rs;
  renderTime(rs, langColour);
  writeHash();
}

/* ---- detail dialog: every field, hidden ones included, plus the captured exchange ---- */
function openDetail(key) {
  const r = (window.__rows || []).find(x => x.key === key);
  if (!r) return;
  const doc = wireDoc(r), e = r.ex;
  const field = (lab, val, hidden) =>
    `<div class="frow${hidden ? ' hid' : ''}"><span class="fk">${esc(lab)}${hidden ? ' <em>hidden</em>' : ''}</span><span class="fv">${cell(lab === 'framing' ? 'framing' : '', val)}</span></div>`;
  const fields = COLS.filter(c => c.label && c.id !== 'bar').map(c => {
    const v = c.id === 'value' ? r.value : c.get(r);
    const lab = c.id === 'value' ? METRICS[st.metric].label : c.label;
    const shown = c.pin || st.cols.has(c.id);
    return `<div class="frow${shown ? '' : ' hid'}"><span class="fk">${esc(lab)}${shown ? '' : ' <em>hidden</em>'}</span><span class="fv">${cell(c.id, v)}</span></div>`;
  }).join('');
  const hdr = hs => hs.map(([k, v]) =>
    `<div class="hrow"><span class="hk">${esc(k)}</span><span class="hv">${esc(v)}</span></div>`).join('');
  const exchange = e ? `
    <div class="wirecols">
      <div><h3>Request</h3>
        <pre class="wire req">${esc(e.m)} ${esc(e.p)}</pre>
        <div class="hdrs">${hdr(e.rh)}</div>
        ${e.rb ? `<pre class="wire">${esc(e.rb)}${e.rbz > 700 ? '\n\u2026 ' + e.rbz.toLocaleString() + ' bytes total' : ''}</pre>` : '<p class="empty" style="padding:6px 0">no body</p>'}
      </div>
      <div><h3>Response</h3>
        <pre class="wire res">HTTP ${e.s}</pre>
        <div class="hdrs">${hdr(e.sh)}</div>
        ${e.sb ? `<pre class="wire">${esc(e.sb)}${e.tr ? '\n\u2026 ' + e.sbz.toLocaleString() + ' bytes total' : ''}</pre>` : '<p class="empty" style="padding:6px 0">no body</p>'}
      </div>
    </div>`
    : `<p class="empty">A captured exchange exists per endpoint. Switch granularity to Endpoint to read one.</p>`;
  document.getElementById('dlgbody').innerHTML = `
    <div class="wirehead"><strong>${esc(r.label)}</strong>
      <span class="ver">${esc(r.version || '')}</span>
      ${r.detail ? `<span class="pill">${esc(r.detail)}</span>` : ''}
      <span class="wmeta">${esc(r.shard)}${doc ? ' \u00b7 ' + esc(doc.framework) : ''}</span></div>
    <div class="fields">${fields}</div>
    ${exchange}`;
  document.getElementById('dlg').showModal();
}

/* ---- the time axis ---- */
function renderTime(rs, langColour) {
  const runs = runsForHost();
  const el = document.getElementById('time');
  const keys = rs.slice(0, 6).map(r => r.key);
  if (runs.length < 2) {
    el.innerHTML = '<p class="empty">One run on this host so far. The time axis fills in as runs accumulate.</p>';
    return;
  }
  const cols = ser();
  const series = new Map();
  runs.forEach(run => {
    const rn = (st.rung && run.rungs.map(String).includes(st.rung)) ? st.rung : pickRung(run);
    run.targets.forEach(t => {
      const base = t.shard + ':' + t.target;
      keys.forEach(k => {
        const [kb, det] = k.split('|');
        if (kb !== base) return;
        let v = null;
        if (!det) { const d = t.rungs[rn]; v = d ? d[st.metric] : null; }
        else if ((run.endpoint_order || []).includes(det)) {
          const i = run.endpoint_order.indexOf(det);
          const a = (t.endpoints || {})[st.metric]; v = a && a[rn] ? a[rn][i] : null;
        } else {
          const fams = (t.families_by_rung || {})[rn] || t.families || {};
          v = fams[det] ? fams[det][st.metric] : null;
        }
        if (v == null) return;
        if (!series.has(k)) series.set(k, []);
        series.get(k).push({date: run.date, v, ver: t.version || ''});
      });
    });
  });
  const live = [...series.entries()].filter(([, pts]) => pts.length);
  if (!live.length || !live.some(([, pts]) => pts.length > 1)) {
    el.innerHTML = '<p class="empty">Not enough runs yet for these rows.</p>';
    return;
  }
  const W = 940, H = 260, P = 78, R = 52;
  const all = live.flatMap(([, pts]) => pts.map(x => x.v));
  const lo = Math.min(...all) * 0.92, hi = Math.max(...all) * 1.08;
  const n = Math.max(...live.map(([, pts]) => pts.length));
  const X = i => P + (W - P - R) * (n < 2 ? 0.5 : i / (n - 1));
  const Y = v => H - 44 - (H - 62) * ((v - lo) / (hi - lo || 1));
  let g = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="' +
          METRICS[st.metric].label + ' over time">';
  for (let k = 0; k <= 4; k++) {
    const v = lo + (hi - lo) * k / 4;
    g += `<line x1="${P}" y1="${Y(v).toFixed(1)}" x2="${W - R}" y2="${Y(v).toFixed(1)}" stroke="var(--rule)" stroke-width="1"/>`;
    g += `<text x="${P - 7}" y="${(Y(v) + 3).toFixed(1)}" fill="var(--ink3)" font-size="10" font-family="var(--f-mono)" text-anchor="end">${fmt(v).replace(' us', '')}</text>`;
  }
  live.forEach(([k, pts], idx) => {
    const c = cols[idx % cols.length];
    g += `<path d="${pts.map((pt, i) => (i ? 'L' : 'M') + ' ' + X(i).toFixed(1) + ' ' + Y(pt.v).toFixed(1)).join(' ')}" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round"/>`;
    let prev = null;
    pts.forEach((pt, i) => {
      const changed = prev !== null && pt.ver && pt.ver !== prev;
      prev = pt.ver || prev;
      const anchor = i === 0 ? 'start' : i >= n - 1 ? 'end' : 'middle';
      g += changed
        ? `<circle cx="${X(i).toFixed(1)}" cy="${Y(pt.v).toFixed(1)}" r="5.5" fill="var(--surface)" stroke="${c}" stroke-width="2"/><text x="${X(i).toFixed(1)}" y="${(Y(pt.v) - 11).toFixed(1)}" fill="${c}" font-size="9" font-family="var(--f-mono)" text-anchor="${anchor}">${esc(pt.ver)}</text>`
        : `<circle cx="${X(i).toFixed(1)}" cy="${Y(pt.v).toFixed(1)}" r="3.2" fill="${c}"/>`;
    });
  });
  const step = Math.max(1, Math.ceil(n / 8));
  runs.slice(0, n).forEach((run, i) => {
    if (i % step && i !== n - 1) return;
    const anchor = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
    g += `<text x="${X(i).toFixed(1)}" y="${H - 16}" fill="var(--ink3)" font-size="10" font-family="var(--f-mono)" text-anchor="${anchor}">${run.date.slice(5)}</text>`;
  });
  g += '</svg>';
  const legend = live.map(([k], i) =>
    `<span><b style="background:${cols[i % cols.length]}"></b>${esc(k.replace('|', ' · '))}</span>`).join('');
  el.innerHTML = g + '<div class="legend">' + legend +
    '<span style="color:var(--ink3)">hollow ring = new framework version</span></div>';
}

/* ---- wiring ---- */
document.getElementById('host').onchange = e => { st.host = e.target.value; st.rung = null; render(); };
document.getElementById('rung').onchange = e => { st.rung = e.target.value; render(); };
document.getElementById('metric').onchange = e => { st.metric = e.target.value; render(); };
document.getElementById('q').oninput = e => { st.q = e.target.value; render(); };
document.querySelectorAll('.seg button[data-gran]').forEach(b =>
  b.onclick = () => { st.gran = b.dataset.gran; render(); });
document.getElementById('chips').onclick = e => {
  const b = e.target.closest('[data-lang]'); if (!b) return;
  const l = b.dataset.lang;
  st.langs.has(l) ? st.langs.delete(l) : st.langs.add(l);
  if (!st.langs.size) st.langs = new Set(langs);
  render();
};
document.getElementById('colchips').onclick = e => {
  const b = e.target.closest('[data-col]'); if (!b) return;
  const c = b.dataset.col;
  st.cols.has(c) ? st.cols.delete(c) : st.cols.add(c);
  render();
};
document.getElementById('thead').onclick = e => {
  const th = e.target.closest('th[data-col]'); if (!th) return;
  const c = th.dataset.col;
  st.sort = {col: c, dir: st.sort.col === c ? -st.sort.dir : 1};
  render();
};
document.getElementById('tbody').onclick = e => {
  const tr = e.target.closest('tr[data-key]'); if (tr) openDetail(tr.dataset.key);
};
document.getElementById('tbody').onkeydown = e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const tr = e.target.closest('tr[data-key]');
  if (tr) { e.preventDefault(); openDetail(tr.dataset.key); }
};
document.getElementById('dlgclose').onclick = () => document.getElementById('dlg').close();
document.getElementById('dlg').onclick = e => {
  if (e.target.id === 'dlg') document.getElementById('dlg').close();
};
document.getElementById('reset').onclick = () => {
  st.langs = new Set(langs); st.q = ''; st.rung = null;
  st.cols = new Set(COLS.filter(c => c.def).map(c => c.id));
  st.sort = {col: 'value', dir: 1}; render();
};
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render);
let ownHash = '';
addEventListener('hashchange', () => {
  if (location.hash === ownHash) return;
  readHash(); render();
});
const _writeHash = writeHash;
writeHash = function () { _writeHash(); ownHash = location.hash; };
readHash(); render();
"""


def render(runs, wire):
    tracked = [r for r in runs if r.get("tracked")]
    now = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    data = json.dumps({"runs": runs, "wire": wire}, separators=(",", ":"))
    app = (APP.replace("__SERIES_LIGHT__", json.dumps(SERIES_LIGHT))
              .replace("__SERIES_DARK__", json.dumps(SERIES_DARK)))
    return ("""<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RequestBench Results</title>
<meta name="description" content="Sortable, filterable HTTP framework results across languages, hosts and time.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:wght@400;600&family=Archivo:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>__CSS__</style></head><body><div class="page">

<p class="eyebrow">blend-v1 &middot; epoch 1 &middot; built __BUILT__</p>
<h1>RequestBench Results</h1>
<p class="lede">Every framework in a run shares one machine and one window, so these are
real latencies and they rank directly against each other. The ratio column is still each
target against the bare baseline in its own language.</p>

<div class="controls">
  <div class="ctl"><label for="host">Execution host</label>
    <select id="host"></select></div>
  <div class="ctl"><label for="rung">Offered rate</label>
    <select id="rung"></select></div>
  <div class="ctl"><label for="metric">Metric</label>
    <select id="metric">
      <option value="p50_us">p50</option>
      <option value="p90_us">p90</option>
      <option value="p99_us">p99</option>
      <option value="p999_us">p99.9</option>
      <option value="p50_ratio">p50 vs baseline</option>
      <option value="p99_ratio">p99 vs baseline</option>
      <option value="achieved_rps">achieved rps</option>
      <option value="dropped">dropped</option>
    </select></div>
  <div class="ctl"><label>Granularity</label>
    <div class="seg" role="group" aria-label="Granularity">
      <button data-gran="blend">Blend</button>
      <button data-gran="family">Family</button>
      <button data-gran="endpoint">Endpoint</button>
    </div></div>
  <div class="ctl"><label>Languages</label><div class="chips" id="chips"></div></div>
  <div class="ctl"><label for="q" id="qlabel">Filter</label>
    <input type="search" id="q" placeholder="endpoint or framework"></div>
  <div class="ctl"><label>Columns</label><div class="chips" id="colchips"></div></div>
  <div class="spacer"></div>
  <div class="ctl"><label>&nbsp;</label>
    <div class="seg"><button id="reset" type="button">Reset</button></div></div>
</div>

<p class="count" id="meta" style="margin:12px 0 0"></p>

<div class="scroll"><table>
  <thead id="thead"></thead>
  <tbody id="tbody"></tbody>
</table></div>
<p class="count" id="count" style="margin-top:10px"></p>

<div class="panel">
  <h2>Over time</h2>
  <p class="hint">Click any row above to pin it here. With nothing pinned this shows the
  top six rows of the current ranking.</p>
  <div id="time"></div>
</div>

<div class="note">Runs happen on GitHub-hosted runners, whose CPU varies between runs, so
an absolute number is comparable to the others <em>in its own run</em> and to nothing else.
The ratio to each language's bare baseline is what carries across runs and across hosts.</div>

<dialog id="dlg">
  <button id="dlgclose" aria-label="Close">&times;</button>
  <div id="dlgbody"></div>
</dialog>

<footer><span>github.com/ipjohnson/RequestBench</span>
<span>__NRUNS__ runs &middot; raw histograms in the run artifacts</span></footer>
</div>
<script>window.__RB__ = __DATA__;</script>
<script>__APP__</script>
</body></html>"""
            .replace("__CSS__", CSS).replace("__BUILT__", esc(now))
            .replace("__NRUNS__", str(len(tracked)))
            .replace("__DATA__", data).replace("__APP__", app))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--summaries", default="results/summary")
    ap.add_argument("--exemplars", default="results/exemplars")
    ap.add_argument("--out", default="site/dist")
    a = ap.parse_args()
    runs = load(a.summaries)
    wire = load_exemplars(a.exemplars)
    out = pathlib.Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "index.html").write_text(render(runs, wire))
    (out / "data.json").write_text(json.dumps(runs, separators=(",", ":")))
    print("read %d summaries (%d tracked)" % (runs.__len__(),
                                              sum(1 for r in runs if r.get("tracked"))))
    print("wrote %s (%.1f KB), %d targets with captured wire data"
          % (out / "index.html", (out / "index.html").stat().st_size / 1024, len(wire)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
