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
%s
%s
  --f-display: "Newsreader", Georgia, serif;
  --f-body: "Archivo", "Helvetica Neue", Arial, sans-serif;
  --f-mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
%s
%s
} }
:root[data-theme="dark"] {
%s
%s
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
table { border-collapse: collapse; width: 100%%; min-width: 760px; font-size: 14px;
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
.barcell { width: 26%%; min-width: 120px; }
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
.wirecell { width: 46px; }
.wirebtn { font-family: var(--f-mono); font-size: 11px; padding: 3px 7px; cursor: pointer;
           border: 1px solid var(--rule2); border-radius: 3px; background: var(--ground);
           color: var(--ink2); }
.wirebtn:hover { border-color: var(--teal); color: var(--tealtext); }
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
.hrow { display: grid; grid-template-columns: minmax(110px, 34%%) 1fr; gap: 10px;
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
""" % (tokens(0), series_css(0, SERIES_LIGHT), tokens(1), series_css(1, SERIES_DARK),
       tokens(1), series_css(1, SERIES_DARK))


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
const S = {light: %s, dark: %s};
const ser = () => (matchMedia('(prefers-color-scheme: dark)').matches &&
                   document.documentElement.dataset.theme !== 'light') ||
                  document.documentElement.dataset.theme === 'dark' ? S.dark : S.light;

const tracked = RB.runs.filter(r => r.tracked);
const hosts   = [...new Set(tracked.map(r => r.exec_host || 'container'))].sort();
const langs   = [...new Set(tracked.flatMap(r => r.targets.map(t => t.shard)))].sort();

const st = {
  host: hosts[0] || 'container',
  langs: new Set(langs),
  rung: null, metric: 'p50_us', gran: 'blend',
  sort: {col: 'value', dir: 1}, q: '',
  pinned: new Set(),
};

/* ---- state in the URL so a view can be shared ---- */
function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  if (p.get('host')) st.host = p.get('host');
  if (p.get('langs')) st.langs = new Set(p.get('langs').split(','));
  if (p.get('rung')) st.rung = p.get('rung');
  if (p.get('metric')) st.metric = p.get('metric');
  if (p.get('gran')) st.gran = p.get('gran');
  if (p.get('q')) st.q = p.get('q');
  if (p.get('pin')) st.pinned = new Set(p.get('pin').split(','));
  if (p.get('sort')) { const [c, d] = p.get('sort').split(':'); st.sort = {col: c, dir: +d}; }
}
let writeHash = function () {
  const p = new URLSearchParams();
  p.set('host', st.host); p.set('metric', st.metric); p.set('gran', st.gran);
  if (st.rung) p.set('rung', st.rung);
  if (st.langs.size !== langs.length) p.set('langs', [...st.langs].join(','));
  if (st.q) p.set('q', st.q);
  if (st.pinned.size) p.set('pin', [...st.pinned].join(','));
  p.set('sort', st.sort.col + ':' + st.sort.dir);
  history.replaceState(null, '', '#' + p.toString());
};

const runsForHost = () => tracked.filter(r => (r.exec_host || 'container') === st.host);
const latest = () => { const rs = runsForHost(); return rs.length ? rs[rs.length - 1] : null; };

function rungsOf(run) { return run ? run.rungs.map(String) : []; }
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

const METRICS = {
  p50_us: {label: 'p50', unit: 'us', lower: true},
  p90_us: {label: 'p90', unit: 'us', lower: true},
  p99_us: {label: 'p99', unit: 'us', lower: true},
  p999_us: {label: 'p99.9', unit: 'us', lower: true},
  p50_ratio: {label: 'p50 vs baseline', unit: 'x', lower: true},
  p99_ratio: {label: 'p99 vs baseline', unit: 'x', lower: true},
  achieved_rps: {label: 'achieved rps', unit: '', lower: false},
  dropped: {label: 'dropped', unit: '', lower: true},
};

/* ---- rows: one per target, or per target x family, or per target x endpoint ---- */
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
    if (st.gran === 'blend') {
      const d = t.rungs[rn]; if (!d) continue;
      const v = st.metric in d ? d[st.metric] : null;
      out.push({...base, label: t.target, detail: '', value: v,
                p50: d.p50_us, p99: d.p99_us, ratio: d.p50_ratio,
                dead: !!d.baseline_saturated, n: d.achieved_rps});
    } else if (st.gran === 'family') {
      const fams = t.families_by_rung && t.families_by_rung[rn] ? t.families_by_rung[rn] : t.families;
      for (const [f, rec] of Object.entries(fams || {})) {
        if (q && !(f.toLowerCase().includes(q) || t.target.toLowerCase().includes(q))) continue;
        out.push({...base, key: base.key + '|' + f, label: t.target, detail: f,
                  value: rec[st.metric] ?? null, p50: rec.p50_us, p99: rec.p99_us,
                  ratio: rec.p50_ratio, dead: false, n: rec.count});
      }
    } else {
      const eps = t.endpoints || {};
      const order = run.endpoint_order || [];
      if (!order.length || !Object.keys(eps).length) continue;
      const fam = run.endpoint_family || [];
      const arr = k => (eps[k] && eps[k][rn]) || [];
      const p50s = arr('p50_us'), p99s = arr('p99_us'), vals = arr(st.metric), cnt = arr('count');
      const rats = arr('p50_ratio');
      order.forEach((eid, i) => {
        if (q && !(eid.toLowerCase().includes(q) || t.target.toLowerCase().includes(q) ||
                   (fam[i] || '').toLowerCase().includes(q))) return;
        if (p50s[i] == null) return;
        out.push({...base, key: base.key + '|' + eid, label: t.target, detail: eid,
                  family: fam[i], value: vals[i] ?? null, p50: p50s[i], p99: p99s[i],
                  ratio: rats[i], dead: false, n: cnt[i]});
      });
    }
  }
  const {col, dir} = st.sort;
  const get = r => col === 'name' ? (r.label + r.detail)
                 : col === 'lang' ? r.shard
                 : col === 'ratio' ? (r.ratio ?? Infinity)
                 : (r[col] ?? (METRICS[st.metric].lower ? Infinity : -Infinity));
  out.sort((a, b) => {
    const x = get(a), y = get(b);
    if (typeof x === 'string') return dir * x.localeCompare(y);
    return dir * (x - y);
  });
  return {run, rn, rows: out};
}

/* A run summarized before per-endpoint detail existed has no endpoints to drill into.
   Saying so beats rendering an empty table that looks like a bug. */
function emptyWhy(run, rn) {
  if (st.gran === 'endpoint' && !(run.endpoint_order || []).length)
    return `This run predates per-endpoint detail, so it can only be read at blend or family level. Later runs carry all 40 endpoints.`;
  if (st.gran === 'endpoint' && !run.targets.some(t => Object.keys(t.endpoints || {}).length))
    return `No per-endpoint data was recorded for this run.`;
  if (!st.langs.size) return 'No languages selected.';
  return 'Nothing matches those filters.';
}

/* Exemplars are keyed <shard>-<target>, and only the endpoint view names an endpoint. */
const wireKey = r => (st.gran === 'endpoint' && RB.wire && RB.wire[r.shard + '-' + r.target])
  ? r.shard + '-' + r.target : '';

function renderWire(key, eid) {
  const box = document.getElementById('wire');
  const doc = RB.wire[key];
  const e = doc && doc.endpoints[eid];
  if (!e) { box.innerHTML = '<p class="empty">No capture for that endpoint.</p>'; return; }
  const hdr = hs => hs.map(([k, v]) =>
    `<div class="hrow"><span class="hk">${k}</span><span class="hv">${esc(v)}</span></div>`).join('');
  box.innerHTML = `
    <div class="wirehead"><strong>${key}</strong> <span class="ver">${doc.version}</span>
      <span class="pill">${eid}</span>
      <span class="wmeta">${e.shz} B headers &middot; ${e.sbz} B body &middot; ${e.fr}</span></div>
    <div class="wirecols">
      <div><h3>Request</h3>
        <pre class="wire req">${esc(e.m)} ${esc(e.p)}</pre>
        <div class="hdrs">${hdr(e.rh)}</div>
        ${e.rb ? `<pre class="wire">${esc(e.rb)}${e.rbz > 700 ? '\n\u2026 ' + e.rbz + ' bytes total' : ''}</pre>` : '<p class="empty" style="padding:8px 0">no body</p>'}
      </div>
      <div><h3>Response</h3>
        <pre class="wire res">HTTP ${e.s}</pre>
        <div class="hdrs">${hdr(e.sh)}</div>
        ${e.sb ? `<pre class="wire">${esc(e.sb)}${e.tr ? '\n\u2026 ' + e.sbz + ' bytes total' : ''}</pre>` : '<p class="empty" style="padding:8px 0">no body</p>'}
      </div>
    </div>`;
  box.scrollIntoView({behavior: 'smooth', block: 'nearest'});
}
const esc = t => String(t).replace(/[&<>]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[c]));

const fmt = v => v == null ? '&mdash;'
  : METRICS[st.metric].unit === 'x' ? v.toFixed(2) + 'x'
  : METRICS[st.metric].unit === 'us' ? Math.round(v).toLocaleString() + ' us'
  : Math.round(v).toLocaleString();

/* ---- render ---- */
function render() {
  const {run, rn, rows: rs} = rows();
  const cols = ser();
  const langColour = Object.fromEntries(langs.map((l, i) => [l, cols[i %% cols.length]]));

  // controls
  const hostSel = document.getElementById('host');
  hostSel.innerHTML = hosts.map(h => `<option${h === st.host ? ' selected' : ''}>${h}</option>`).join('');
  const rungSel = document.getElementById('rung');
  rungSel.innerHTML = run ? rungsOf(run).map(r =>
      `<option value="${r}"${r === rn ? ' selected' : ''}>${offered(run, r).toLocaleString()} rps</option>`).join('') : '';
  document.getElementById('metric').value = st.metric;
  document.querySelectorAll('.seg button').forEach(b =>
      b.setAttribute('aria-pressed', b.dataset.gran === st.gran));
  document.getElementById('chips').innerHTML = langs.map(l =>
      `<button class="chip" data-lang="${l}" aria-pressed="${st.langs.has(l)}"` +
      `${st.langs.has(l) ? ` style="background:${langColour[l]}"` : ''}>` +
      `<i style="background:${st.langs.has(l) ? 'currentColor' : langColour[l]}"></i>${l}</button>`).join('');
  document.getElementById('q').value = st.q;
  document.getElementById('q').style.display = st.gran === 'blend' ? 'none' : '';
  document.getElementById('qlabel').style.display = st.gran === 'blend' ? 'none' : '';

  if (!run) {
    document.getElementById('meta').textContent = 'no tracked runs for this host yet';
    document.getElementById('tbody').innerHTML = '';
    document.getElementById('time').innerHTML = '<p class="empty">No data.</p>';
    writeHash(); return;
  }
  document.getElementById('meta').textContent =
      `${run.date} · ${run.cpu}, ${run.cores} cores · ${rs.length} rows · baseline per language`;

  // table
  const m = METRICS[st.metric];
  const finite = rs.map(r => r.value).filter(v => v != null && isFinite(v));
  const worst = finite.length ? Math.max(...finite) : 1;
  document.getElementById('vhead').textContent = m.label;
  document.getElementById('tbody').innerHTML = rs.map((r, i) => {
    const w = r.value != null && isFinite(r.value) ? Math.max(1.5, 100 * r.value / worst) : 0;
    const ratio = r.ratio == null ? '&mdash;'
      : `<span>${r.ratio.toFixed(2)}x</span>`;
    return `<tr data-key="${r.key}" aria-selected="${st.pinned.has(r.key)}">
      <td class="rank">${i + 1}</td>
      <td class="name l"><span class="swatch" style="background:${langColour[r.shard]}"></span>${r.label}${r.isBase ? '<span class="pill">baseline</span>' : ''}</td>
      <td class="sub l">${r.detail || r.shard}</td>
      <td class="sub">${r.version || '&mdash;'}</td>
      <td class="${r.dead ? 'dead ' : ''}">${fmt(r.value)}</td>
      <td class="ratio ${r.isBase ? 'base' : (r.ratio > 1.15 ? 'up' : '')}">${ratio}</td>
      <td class="sub">${(r.n ?? 0).toLocaleString()}</td>
      <td class="barcell"><div class="bar${r.isBase ? ' b' : ''}" style="width:${w}%%;background:${r.isBase ? '' : langColour[r.shard]}"></div></td>
      <td class="wirecell">${wireKey(r) ? `<button class="wirebtn" data-wire="${wireKey(r)}|${r.detail}" title="show the captured request and response">&lt;/&gt;</button>` : ''}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="9" class="empty">${emptyWhy(run, rn)}</td></tr>`;
  document.getElementById('count').textContent = `${rs.length} rows`;

  renderTime(rs, langColour);
  writeHash();
}

/* ---- the time axis: the selected metric over every run on this host ---- */
function renderTime(rs, langColour) {
  const host = st.host, rnWanted = st.rung;
  const runs = runsForHost();
  const el = document.getElementById('time');
  const keys = st.pinned.size ? [...st.pinned] : rs.slice(0, 6).map(r => r.key);
  if (runs.length < 2) {
    el.innerHTML = `<p class="empty">One run on this host so far. The time axis fills in as runs accumulate.</p>`;
    return;
  }
  const cols = ser();
  const series = new Map();
  runs.forEach(run => {
    const rn = (rnWanted && run.rungs.map(String).includes(rnWanted)) ? rnWanted : pickRung(run);
    run.targets.forEach(t => {
      const base = t.shard + ':' + t.target;
      keys.forEach(k => {
        const [kb, det] = k.split('|');
        if (kb !== base) return;
        let v = null, ver = t.version || '';
        if (!det) { const d = t.rungs[rn]; v = d ? d[st.metric] : null; }
        else if (run.endpoint_order && run.endpoint_order.includes(det)) {
          const i = run.endpoint_order.indexOf(det);
          const a = (t.endpoints || {})[st.metric]; v = a && a[rn] ? a[rn][i] : null;
        } else {
          const fams = (t.families_by_rung || {})[rn] || t.families || {};
          v = fams[det] ? fams[det][st.metric] : null;
        }
        if (v == null) return;
        if (!series.has(k)) series.set(k, []);
        series.get(k).push({date: run.date, v, ver});
      });
    });
  });
  const live = [...series.entries()].filter(([, p]) => p.length);
  if (!live.length || !live.some(([, p]) => p.length > 1)) {
    el.innerHTML = `<p class="empty">Not enough runs yet for these rows.</p>`;
    return;
  }
  // Left padding has to hold six-figure microsecond labels; right padding holds a
  // version string sitting above the last point.
  const W = 940, H = 260, P = 78, R = 52;
  const all = live.flatMap(([, p]) => p.map(x => x.v));
  const lo = Math.min(...all) * 0.92, hi = Math.max(...all) * 1.08;
  const n = Math.max(...live.map(([, p]) => p.length));
  const X = i => P + (W - P - R) * (n < 2 ? 0.5 : i / (n - 1));
  const Y = v => H - 44 - (H - 62) * ((v - lo) / (hi - lo || 1));
  let g = `<svg viewBox="0 0 ${W} ${H}" width="100%%" role="img" aria-label="${METRICS[st.metric].label} over time">`;
  for (let k = 0; k <= 4; k++) {
    const v = lo + (hi - lo) * k / 4;
    g += `<line x1="${P}" y1="${Y(v).toFixed(1)}" x2="${W - R}" y2="${Y(v).toFixed(1)}" stroke="var(--rule)" stroke-width="1"/>`;
    g += `<text x="${P - 7}" y="${(Y(v) + 3).toFixed(1)}" fill="var(--ink3)" font-size="10" font-family="var(--f-mono)" text-anchor="end">${fmt(v).replace(' us', '')}</text>`;
  }
  live.forEach(([k, pts], idx) => {
    const c = cols[idx %% cols.length];
    g += `<path d="${pts.map((p, i) => (i ? 'L' : 'M') + ' ' + X(i).toFixed(1) + ' ' + Y(p.v).toFixed(1)).join(' ')}" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round"/>`;
    let prev = null;
    pts.forEach((p, i) => {
      const changed = prev !== null && p.ver && p.ver !== prev;
      prev = p.ver || prev;
      g += changed
        ? `<circle cx="${X(i).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="5.5" fill="var(--surface)" stroke="${c}" stroke-width="2"/><text x="${X(i).toFixed(1)}" y="${(Y(p.v) - 11).toFixed(1)}" fill="${c}" font-size="9" font-family="var(--f-mono)" text-anchor="${i === 0 ? 'start' : i >= n - 1 ? 'end' : 'middle'}">${p.ver}</text>`
        : `<circle cx="${X(i).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="3.2" fill="${c}"/>`;
    });
  });
  // One tick per run, not per distinct date: several runs can share a day, and labelling
  // by date put the ticks under the wrong points entirely.
  const step = Math.max(1, Math.ceil(n / 8));
  runs.slice(0, n).forEach((r, i) => {
    if (i %% step && i !== n - 1) return;
    const anchor = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
    g += `<text x="${X(i).toFixed(1)}" y="${H - 16}" fill="var(--ink3)" font-size="10" font-family="var(--f-mono)" text-anchor="${anchor}">${r.date.slice(5)}</text>`;
  });
  g += '</svg>';
  const legend = live.map(([k], i) =>
    `<span><b style="background:${cols[i %% cols.length]}"></b>${k.replace('|', ' · ')}</span>`).join('');
  el.innerHTML = g + `<div class="legend">${legend}<span style="color:var(--ink3)">hollow ring = new framework version</span></div>`;
}

/* ---- wiring ---- */
document.getElementById('host').onchange = e => { st.host = e.target.value; st.rung = null; render(); };
document.getElementById('rung').onchange = e => { st.rung = e.target.value; render(); };
document.getElementById('metric').onchange = e => { st.metric = e.target.value; render(); };
document.getElementById('q').oninput = e => { st.q = e.target.value; render(); };
document.querySelectorAll('.seg button').forEach(b => b.onclick = () => { st.gran = b.dataset.gran; render(); });
document.getElementById('chips').onclick = e => {
  const b = e.target.closest('[data-lang]'); if (!b) return;
  const l = b.dataset.lang;
  st.langs.has(l) ? st.langs.delete(l) : st.langs.add(l);
  if (!st.langs.size) st.langs = new Set(langs);
  render();
};
document.querySelectorAll('thead th[data-col]').forEach(th => th.onclick = () => {
  const c = th.dataset.col;
  st.sort = {col: c, dir: st.sort.col === c ? -st.sort.dir : 1};
  document.querySelectorAll('thead th').forEach(x => x.removeAttribute('aria-sort'));
  th.setAttribute('aria-sort', st.sort.dir === 1 ? 'ascending' : 'descending');
  render();
});
document.getElementById('tbody').onclick = e => {
  const wb = e.target.closest('[data-wire]');
  if (wb) { const [k, eid] = wb.dataset.wire.split('|'); renderWire(k, eid); return; }
  const tr = e.target.closest('tr[data-key]'); if (!tr) return;
  const k = tr.dataset.key;
  st.pinned.has(k) ? st.pinned.delete(k) : st.pinned.add(k);
  render();
};
document.getElementById('reset').onclick = () => {
  st.langs = new Set(langs); st.q = ''; st.pinned.clear(); st.rung = null;
  st.sort = {col: 'value', dir: 1}; render();
};
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render);
/* A shared link pasted into an already-open tab, or the back button, changes the hash
   without reloading. Without this the URL and the view silently disagree. */
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
    app = APP % (json.dumps(SERIES_LIGHT), json.dumps(SERIES_DARK))
    return """<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RequestBench Results</title>
<meta name="description" content="Sortable, filterable HTTP framework results across languages, hosts and time.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:wght@400;600&family=Archivo:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>%s</style></head><body><div class="page">

<p class="eyebrow">blend-v1 &middot; epoch 1 &middot; built %s</p>
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
  <div class="spacer"></div>
  <div class="ctl"><label>&nbsp;</label>
    <div class="seg"><button id="reset" type="button">Reset</button></div></div>
</div>

<p class="count" id="meta" style="margin:12px 0 0"></p>

<div class="scroll"><table>
  <thead><tr>
    <th style="cursor:default">#</th>
    <th class="l" data-col="name">framework</th>
    <th class="l" data-col="lang">slice</th>
    <th>version</th>
    <th data-col="value" aria-sort="ascending"><span id="vhead">p50</span></th>
    <th data-col="ratio">vs baseline</th>
    <th data-col="n">samples</th>
    <th class="barcell" style="cursor:default"></th>
    <th class="wirecell" style="cursor:default">wire</th>
  </tr></thead>
  <tbody id="tbody"></tbody>
</table></div>
<p class="count" id="count" style="margin-top:10px"></p>

<div class="panel">
  <h2>On the wire</h2>
  <p class="hint">Switch granularity to Endpoint and press <code>&lt;/&gt;</code> on any row to
  read the exact request and response the conformance gate captured for it.</p>
  <div id="wire"><p class="empty">Nothing selected.</p></div>
</div>

<div class="panel">
  <h2>Over time</h2>
  <p class="hint">Click any row above to pin it here. With nothing pinned this shows the
  top six rows of the current ranking.</p>
  <div id="time"></div>
</div>

<div class="note">Runs happen on GitHub-hosted runners, whose CPU varies between runs, so
an absolute number is comparable to the others <em>in its own run</em> and to nothing else.
The ratio to each language's bare baseline is what carries across runs and across hosts.</div>

<footer><span>github.com/ipjohnson/RequestBench</span>
<span>%d runs &middot; raw histograms in the run artifacts</span></footer>
</div>
<script>window.__RB__ = %s;</script>
<script>%s</script>
</body></html>""" % (CSS, esc(now), len(tracked), data, app)


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
