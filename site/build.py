"""Render the results explorer from committed summaries.

One self-contained page. The summaries are embedded, so it works from file:// and from
Pages identically, and every slice happens in the browser rather than at build time.

  python3 site/build.py --summaries results/summary --out site/dist
"""
import argparse, gzip, html, json, pathlib, re, sys, datetime as dt

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
/* The delta against the endpoint's base. Amber is a cost, teal a saving, and grey is a
   number smaller than the histogram can resolve, which is the answer rather than a gap. */
td.delta { font-family: var(--f-mono); font-variant-numeric: tabular-nums; }
td.delta.up { color: var(--amber); }
td.delta.down { color: var(--tealtext); }
td.delta.flat, td.delta.root { color: var(--ink3); }
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
.fwlink { font-family: var(--f-mono); font-size: 11.5px; margin-left: auto; }
.crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 7px;
          font-family: var(--f-mono); font-size: 12px; margin: 0 0 16px; }
.crumbs button { font: inherit; background: none; border: none; padding: 0; cursor: pointer;
                 color: var(--tealtext); text-decoration: underline; }
.crumbs i { font-style: normal; color: var(--ink3); }
.crumbs span { color: var(--ink); }
h3.childcap { font-family: var(--f-display); font-size: 17px; font-weight: 600;
              margin: 20px 0 8px; }
.childscroll { max-height: 42vh; }
td.route { font-family: var(--f-mono); font-size: 12px; color: var(--ink2); }
td.route .verb { color: var(--tealtext); }
.leafroute { font-family: var(--f-mono); font-size: 13px; color: var(--ink2);
             margin: 0 0 14px; word-break: break-all; }
.leafroute .verb { color: var(--tealtext); }
.childscroll td.go { color: var(--tealtext); text-align: right; }
.childscroll tbody tr:hover td.go { text-decoration: underline; }
/* The chain from this endpoint down to its root, one row per factor. */
table.chain td.factor { font-family: var(--f-mono); font-size: 12px; color: var(--ink); }
table.chain td.reads { color: var(--ink2); font-size: 13px; }
table.chain td.step { font-family: var(--f-mono); font-size: 12px; color: var(--ink3);
                      white-space: nowrap; }
table.chain tr.total td { border-top: 1px solid var(--rule2); font-weight: 600; }
table.chain tr.total td.reads { color: var(--ink); font-weight: 500; }
.nofloor { color: var(--ink3); font-size: 12px; margin: 6px 0 0; }
.sniphead { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: baseline;
            font-family: var(--f-mono); font-size: 11.5px; margin: 0 0 6px;
            color: var(--ink3); }
pre.code { font-family: var(--f-mono); font-size: 12px; line-height: 1.55; margin: 0 0 6px;
           background: var(--surface); border: 1px solid var(--rule);
           border-left: 2px solid var(--teal); border-radius: 0 3px 3px 0;
           padding: 11px 14px; overflow-x: auto; white-space: pre; }
.how { font-family: var(--f-mono); font-size: 10px; letter-spacing: .08em;
       text-transform: uppercase; color: var(--ink3); }
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


def host_notes():
    """What a host is, and what it should be compared against, straight from the spec."""
    try:
        m = json.loads((pathlib.Path(__file__).resolve().parent.parent
                        / "spec" / "matrix.json").read_text())
    except (OSError, json.JSONDecodeError):
        return {}
    return {h: {"note": cfg.get("note", ""), "compare_to": cfg.get("compare_to", "")}
            for h, cfg in m.get("hosts", {}).items() if cfg.get("note")}


def read_spec():
    try:
        return json.loads((pathlib.Path(__file__).resolve().parent.parent
                           / "spec" / "endpoints.json").read_text())
    except (OSError, json.JSONDecodeError):
        return {}


def spec_routes(spec):
    """Method, route and base edge per endpoint id, for the endpoint lists in the dialog.

    The summary carries ids and families but never the route, and an id alone does not say
    what was asked for. Forty-five short strings, so they ride in the page rather than
    being fetched.

    `b` and `v` are the base and the factor varied from it. They come from the spec rather
    than the run because a run records what was measured and never why two endpoints are a
    pair, and a delta that named the wrong pair would be wrong in a way no number shows.
    A run older than the current spec loses its deltas, which is correct: the pairing it
    was measured under is not this one.
    """
    out = {}
    for e in spec.get("endpoints", []):
        row = {"m": e.get("method", ""), "p": e.get("path", "")}
        if "base" in e and "varies" in e:
            row["b"], row["v"] = e["base"], e["varies"]
        out[e["id"]] = row
    return out


def spec_factors(spec):
    """What each factor reads as, so the delta is a sentence rather than two ids."""
    return {k: v.get("reads", "") for k, v in (spec.get("factors") or {}).items()}


def load_exemplars(d):
    """One request/response pair per endpoint per target, captured by the conformance gate.

    Bodies are trimmed for display; the full capture stays in results/exemplars on main.
    """
    out = {}
    for f in sorted(pathlib.Path(d).rglob("*.json")):
        key = f.stem                      # <language>-<target>@<host>
        try:
            doc = json.loads(f.read_text())
        except json.JSONDecodeError:
            continue
        eps = {}
        for e in doc.get("endpoints", []):
            req, res = e["request"], e["response"]
            eps[e["endpoint"]] = {
                "family": e.get("family", ""),
                "m": req["method"], "p": req["path"],
                "rh": req["headers"], "rb": (req.get("body") or "")[:700],
                "rbz": req.get("body_bytes", 0),
                "s": res["status"], "sh": res["headers"],
                "shz": res["header_bytes"], "sbz": res["body_bytes"],
                "fr": res.get("framing", ""),
                "sb": res["body"][:700], "tr": res.get("truncated") or len(res["body"]) > 700,
            }
        out[key] = {"framework": doc.get("framework", ""), "version": doc.get("version", ""),
                    "adapter": doc.get("adapter", ""),
                    "serializer": doc.get("serializer", ""),
                    "endpoints": eps}
    return out


def is_keyed(r):
    """Whether this summary holds per-endpoint statistics keyed by endpoint id.

    The shape changed when parallel arrays indexed by endpoint_order were replaced by a
    map. A summary written before that is skipped rather than converted: reading it
    positionally is the mistake the map exists to make impossible, and a converter would
    be code kept alive for data nothing wants.
    """
    for t in r.get("targets", []):
        eps = t.get("endpoints")
        if isinstance(eps, dict) and eps:
            return all(isinstance(v, dict) and "rungs" in v for v in eps.values())
    return True


def load(d):
    runs, stale = [], 0
    # Summaries are filed by month, so walk rather than glob one level.
    for f in sorted(pathlib.Path(d).rglob("*.json")):
        if f.name.startswith("."):
            continue
        try:
            r = json.loads(f.read_text())
        except json.JSONDecodeError:
            print("  skipping unreadable %s" % f, file=sys.stderr)
            continue
        if not is_keyed(r):
            stale += 1
            continue
        runs.append(r)
    if stale:
        print("  skipped %d summary file(s) older than the keyed endpoint shape" % stale,
              file=sys.stderr)
    runs.sort(key=lambda r: r["run_id"])
    return runs


APP = r"""
const RB = window.__RB__;
const S = {light: __SERIES_LIGHT__, dark: __SERIES_DARK__};
const ser = () => (matchMedia('(prefers-color-scheme: dark)').matches &&
                   document.documentElement.dataset.theme !== 'light') ||
                  document.documentElement.dataset.theme === 'dark' ? S.dark : S.light;

/* RB.runs holds the newest run per host, embedded so the table paints immediately.
   RB.manifest lists every run; the rest are fetched only when something needs them. */
const loaded = new Map(RB.runs.map(r => [r.run_id, r]));
const manifest = (RB.manifest || []).filter(m => m.tracked);
const inflight = new Map();

function runsFor(host) {
  return manifest.filter(m => m.exec_host === host)
                 .map(m => loaded.get(m.id)).filter(Boolean)
                 .sort((a, b) => a.run_id < b.run_id ? -1 : 1);
}

/* Pages serves a .gz as application/gzip with no Content-Encoding, so the browser hands
   back raw bytes and the stream has to be unwrapped here. */
async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  if (!url.endsWith('.gz')) return res.json();
  const stream = res.body.pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).json();
}

async function fetchHostRuns(host) {
  const want = manifest.filter(m => m.exec_host === host && !loaded.has(m.id));
  if (!want.length) return false;
  await Promise.all(want.map(async (m) => {
    if (inflight.has(m.id)) return inflight.get(m.id);
    const p = fetchJson(m.file)
      .then(run => { if (run) loaded.set(m.id, run); })
      .catch(() => {});
    inflight.set(m.id, p);
    return p;
  }));
  return true;
}

const tracked = RB.runs.filter(r => r.tracked);
const hosts   = [...new Set(manifest.map(m => m.exec_host))].sort();
const langs   = [...new Set(tracked.flatMap(r => r.targets.map(t => t.language)))].sort();

const METRICS = {
  p50_us: {label: 'p50', unit: 'us'}, p90_us: {label: 'p90', unit: 'us'},
  p99_us: {label: 'p99', unit: 'us'}, p999_us: {label: 'p99.9', unit: 'us'},
  achieved_rps: {label: 'achieved rps', unit: ''}, dropped: {label: 'dropped', unit: ''},
};

/* The table shows the columns you pick. Everything else still exists and shows up in the
   detail dialog, so hiding a column narrows the view without losing the number. */
const COLS = [
  {id: 'version', label: 'version',     def: true,  cls: 'sub',   get: r => r.version || '\u2014'},
  {id: 'adapter', label: 'adapter',     def: false, cls: 'sub',   get: r => r.adapter || '\u2014'},
  {id: 'serializer', label: 'serializer', def: false, cls: 'sub', get: r => r.serializer || '\u2014'},
  {id: 'value',   label: '',            def: true,  pin: true,    get: r => r.value},
  /* Only at endpoint granularity: a family and the blend are merges and have no base.
     Sorting by it is the cross-framework view, which is what gzip costing actix-web 431 us
     and gorilla-mux 3,325 us is only visible in. */
  {id: 'delta',   label: 'over base',   def: true,  gran: 'endpoint',
                                                                  get: r => r.delta ? r.delta.total : null},
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

const runsForHost = () => runsFor(st.host);
const latest = () => { const rs = runsForHost(); return rs.length ? rs[rs.length - 1] : null; };
const rungsOf = run => run ? run.rungs.map(String) : [];
function pickRung(run) {
  if (!run) return null;
  const rs = rungsOf(run);
  if (st.rung && rs.includes(st.rung)) return st.rung;
  const clean = rs.filter(rn => !run.targets.some(t => (t.rungs[rn] || {}).saturated));
  return clean.length ? clean[clean.length - 1] : rs[Math.floor(rs.length / 2)];
}
/* A serial run has no offered rate: it replays a pinned order one at a time, so the
   control names the suite rather than a rate that does not exist. */
const isSerial = run => (run.suite || '').startsWith('serial');
const rateLabel = (run, rn) => {
  if (isSerial(run)) return 'serial, one at a time';
  for (const t of run.targets) if (t.rungs[rn]) return t.rungs[rn].offered_rps.toLocaleString() + ' rps';
  return String(rn);
};
const esc = t => String(t).replace(/[&<>"]/g, c =>
  ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

/* ---- wire data, aggregated to whatever granularity is on screen ---- */
/* Exemplars are keyed <language>-<target>@<host>: the same framework on two hosts puts
   different things on the wire, which is the point of the host axis. */
/* Exemplars are keyed <language>-<target>@<host> and fetched when a dialog asks for one. */
const wireKeyFor = (r) => {
  const run = latest(), host = (run && run.exec_host) || 'container';
  const idx = RB.wireIndex || {};
  const k = `${r.language}-${r.target}@${host}`;
  return idx[k] ? k : (idx[`${r.language}-${r.target}`] ? `${r.language}-${r.target}` : null);
};
const wireCache = new Map();
const wireDoc = (r) => {
  const k = wireKeyFor(r);
  return k ? wireCache.get(k) : undefined;
};
async function fetchWire(key) {
  if (wireCache.has(key)) return wireCache.get(key);
  const meta = (RB.wireIndex || {})[key];
  if (!meta) return null;
  const doc = await fetchJson(meta.file).catch(() => null);
  if (doc) wireCache.set(key, doc);
  return doc;
}
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
    if (!st.langs.has(t.language)) continue;
    const base = {target: t.target, language: t.language, version: t.version || '',
                  adapter: t.adapter || '', serializer: t.serializer || '',
                  key: t.language + ':' + t.target};
    const push = o => { const r = {...base, ...o}; Object.assign(r, wireFor(r)); out.push(r); };
    if (st.gran === 'blend') {
      const d = t.rungs[rn]; if (!d) continue;
      push({label: t.target, detail: '', value: d[st.metric] ?? null,
            dead: !d.completed, n: d.achieved_rps});
    } else if (st.gran === 'family') {
      const fams = famsAt(t, rn);
      for (const [f, rec] of Object.entries(fams)) {
        if (q && !(f.toLowerCase().includes(q) || t.target.toLowerCase().includes(q))) continue;
        push({key: base.key + '|' + f, label: t.target, detail: f,
              value: rec[st.metric] ?? null, dead: false, n: rec.count});
      }
    } else {
      const eps = t.endpoints || {}, order = run.endpoint_order || [];
      if (!order.length || !Object.keys(eps).length) continue;
      order.forEach(eid => {
        const rec = eps[eid]; if (!rec) return;
        const d = (rec.rungs || {})[rn]; if (!d) return;
        if (q && !(eid.toLowerCase().includes(q) || t.target.toLowerCase().includes(q) ||
                   (rec.family || '').toLowerCase().includes(q))) return;
        push({key: base.key + '|' + eid, label: t.target, detail: eid, family: rec.family,
              value: d[st.metric] ?? null, dead: false, n: d.count,
              delta: deltaFor(t, eid, rn)});
      });
    }
  }
  const {col, dir} = st.sort;
  const spec = COLS.find(c => c.id === col);
  const get = r => col === 'name' ? (r.label + r.detail)
                 : col === 'lang' ? r.language
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
  : (id === 'hdrz' || id === 'bodyz') ? 'B' : '';
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
const forGran = c => !c.gran || c.gran === st.gran;
function visibleCols() { return COLS.filter(c => (c.pin || st.cols.has(c.id)) && forGran(c)); }

function render() {
  const {run, rn, rows: rs} = rows();
  const cols = ser();
  const langColour = Object.fromEntries(langs.map((l, i) => [l, cols[i % cols.length]]));

  document.getElementById('host').innerHTML =
      hosts.map(h => `<option${h === st.host ? ' selected' : ''}>${h}</option>`).join('');
  document.getElementById('rung').innerHTML = run ? rungsOf(run).map(r =>
      `<option value="${r}"${r === rn ? ' selected' : ''}>${rateLabel(run, r)}</option>`).join('') : '';
  document.getElementById('runglabel').textContent = isSerial(run) ? 'Suite' : 'Offered rate';
  document.getElementById('metric').value = st.metric;
  document.querySelectorAll('.seg button[data-gran]').forEach(b =>
      b.setAttribute('aria-pressed', b.dataset.gran === st.gran));
  document.getElementById('chips').innerHTML = langs.map(l =>
      `<button class="chip" data-lang="${l}" aria-pressed="${st.langs.has(l)}"` +
      `${st.langs.has(l) ? ` style="background:${langColour[l]}"` : ''}>` +
      `<i style="background:${st.langs.has(l) ? 'currentColor' : langColour[l]}"></i>${l}</button>`).join('');
  document.getElementById('colchips').innerHTML = COLS.filter(c => !c.pin && c.label && forGran(c)).map(c =>
      `<button class="chip sm" data-col="${c.id}" aria-pressed="${st.cols.has(c.id)}">${c.label}</button>`).join('');
  document.getElementById('q').value = st.q;
  for (const id of ['q', 'qlabel'])
    document.getElementById(id).style.display = st.gran === 'blend' ? 'none' : '';

  if (!run) {
    renderHostNote(rs);
  document.getElementById('meta').textContent = 'no tracked runs for this host yet';
    document.getElementById('thead').innerHTML = '';
    document.getElementById('tbody').innerHTML = '';
    document.getElementById('time').innerHTML = '<p class="empty">No data.</p>';
    writeHash(); return;
  }
  document.getElementById('meta').textContent =
      `${run.date} \u00b7 ${run.cpu}, ${run.cores} cores \u00b7 ${run.exec_host || 'container'}`
      + ` \u00b7 ${isSerial(run) ? 'serial' : 'rate ladder'} \u00b7 ${rs.length} rows \u00b7 click a row for detail`;

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
        return `<td class="barcell"><div class="bar" style="width:${w}%;background:${langColour[r.language]}"></div></td>`;
      if (c.id === 'delta') return deltaCell(r.delta);
      const v = c.get(r);
      const extra = c.id === 'value' && r.dead ? ' dead' : '';
      return `<td class="${c.cls || ''}${extra}">${cell(c.id, v)}</td>`;
    }).join('');
    return `<tr data-key="${esc(r.key)}" tabindex="0">
      <td class="rank">${i + 1}</td>
      <td class="name l"><span class="swatch" style="background:${langColour[r.language]}"></span>${esc(r.label)}</td>
      <td class="sub l">${esc(r.detail || r.language)}</td>${tds}</tr>`;
  }).join('') || `<tr><td colspan="${vc.length + 3}" class="empty">${emptyWhy(run)}</td></tr>`;
  document.getElementById('count').textContent = `${rs.length} rows`;

  window.__rows = rs;
  renderTime(rs, langColour);
  writeHash();
}

/* A host that is a library choice rather than a platform gets an asterisk, and the
   asterisk carries the measured cost rather than an opinion. */
function renderHostNote(rs) {
  const box = document.getElementById('hostnote');
  const meta = (RB.hosts || {})[st.host];
  if (!meta) { box.style.display = 'none'; return; }
  box.style.display = '';
  let delta = '';
  const other = meta.compare_to;
  if (other) {
    const there = runsFor(other);
    if (!there.length) {
      fetchHostRuns(other).then(got => { if (got) render(); });
    } else {
      const ref = there[there.length - 1];
      const refRn = pickRung(ref);
      const pairs = [];
      for (const r of rs) {
        if (r.detail) continue;
        const t = ref.targets.find(x => x.language === r.language && x.target === r.target);
        const d = t && t.rungs[refRn];
        if (d && d.p50_us && r.p50) pairs.push([r.label, r.p50 / d.p50_us]);
      }
      if (pairs.length) {
        const lo = Math.min(...pairs.map(p => p[1])), hi = Math.max(...pairs.map(p => p[1]));
        delta = ` Measured against <strong>${esc(other)}</strong> on the same targets, this host costs `
              + (hi < 1.05
                  ? `nothing measurable (${lo.toFixed(2)}\u2013${hi.toFixed(2)}x).`
                  : `${lo.toFixed(2)}\u2013${hi.toFixed(2)}x.`);
      }
    }
  }
  box.innerHTML = `<strong>${esc(st.host)}</strong> &mdash; ${esc(meta.note)}${delta}`;
}

/* A framework page is per target, but a row's key carries its slice: node:fastify at blend
   granularity, node:fastify|domain at family. Look the page up by the target itself, or
   the link appears on one of the three views and not the other two. */
const fwPage = (r) => (RB.pages || {})[r.language + ':' + r.target];

/* ---- detail dialog: every field, hidden ones included, plus the captured exchange ---- */
/* ---- code: one handler document per target, fetched when a dialog asks for one ---- */
const codeCache = new Map();
async function fetchCode(key) {
  if (codeCache.has(key)) return codeCache.get(key);
  const file = (RB.codeIndex || {})[key];
  if (!file) return null;
  const doc = await fetchJson(file).catch(() => null);
  codeCache.set(key, doc);
  return doc;
}

/* ---- the dialog: a drill-down, blend to family to endpoint ---- */
/* The table shows one level at a time. The dialog is where you go down: a blend opens its
   families, a family opens the endpoints that made it, and an endpoint is the leaf that
   carries the handler and the captured exchange. Opening a row at any level lands you at
   that level rather than at whichever one the table happened to be on. */
let dlgAt = null;

/* `families` is the middle rung's copy, kept for summaries written before the rung-keyed
   one existed. Falling back to it per-rung would label mid-rung numbers as whatever rung
   is selected, so it is used only when the rung-keyed map is absent altogether. */
function famsAt(t, rn) {
  const byRung = t.families_by_rung;
  if (byRung && Object.keys(byRung).length) return byRung[rn] || {};
  return t.families || {};
}

function famRowsFor(run, t, rn) {
  const fams = famsAt(t, rn);
  return Object.entries(fams).map(([f, rec]) => ({
    id: f, value: rec[st.metric] ?? rec.p50_us, n: rec.count,
    // Counted from this target rather than from the spec, so the number matches the list
    // you get when you open the row.
    eps: epRowsFor(run, t, rn, f).length,
  })).sort((a, b) => (a.value ?? Infinity) - (b.value ?? Infinity));
}

function epRowsFor(run, t, rn, family) {
  const eps = t.endpoints || {}, out = [];
  for (const eid of run.endpoint_order || []) {
    const rec = eps[eid];
    if (!rec || (family && rec.family !== family)) continue;
    const d = (rec.rungs || {})[rn];
    if (!d) continue;
    out.push({id: eid, family: rec.family, value: d[st.metric] ?? d.p50_us,
              n: d.count, delta: deltaFor(t, eid, rn)});
  }
  return out.sort((a, b) => (a.value ?? Infinity) - (b.value ?? Infinity));
}

/* A run older than the current spec carries ids the spec no longer defines, so a miss is
   blank rather than a route belonging to something else. */
const routeOf = (eid) => (RB.routes || {})[eid];

/* ---- the delta against an endpoint's base ----

   spec/endpoints.json pairs most endpoints with a base and names the one factor that
   differs. Walking `base` to a root gives a chain, and because every step is a difference
   of the same two published numbers the chain telescopes: the steps sum to the total over
   the root exactly. So one subtraction answers both "what did gzip cost" and "what does
   this endpoint cost over the floor", and the two always agree.

   There is no single root. A chain ends wherever subtracting one more factor would start
   mixing two, so json.small roots the GET chains and body.bind_small roots the POST ones.
   Comparing a POST to json.small would fold request parsing into the delta. */
const MAX_CHAIN = 16;

function chainOf(eid) {
  const steps = [];
  let cur = eid;
  /* harness/plan.py rejects a cycle, so this bound is only reached if a page is serving a
     spec that check never saw. Stopping quietly beats hanging the tab. */
  while (steps.length < MAX_CHAIN) {
    const r = routeOf(cur);
    if (!r || !r.b) break;
    steps.push({arm: cur, base: r.b, factor: r.v});
    cur = r.b;
  }
  return steps;
}

/* Every percentile is read off a histogram that grows 2% a bucket, so a published number
   is one grid point and a difference of two carries both their errors. Twice the bucket
   at the larger of the pair is the smallest difference that is the framework rather than
   the grid. Below it the honest reading is that the factor adds no measurable time, which
   is a result: sixteen no-op layers costing nothing is what that family is there to say.

   This is the resolution of the instrument, not a measured repeatability floor. Setting
   the second takes repeat runs of one target at one rung, which no run has done, and it
   will be the larger of the two. */
const BUCKET = 0.02, FLOOR_BUCKETS = 2;
const floorFor = (a, b) => BUCKET * FLOOR_BUCKETS * Math.max(Math.abs(a), Math.abs(b));

/* The value the delta is taken on is the selected metric and nothing else. achieved_rps
   and dropped are rung statistics no endpoint carries, and substituting p50 there would
   put a p50 difference under a column headed dropped. No delta is the honest answer. */
function epValue(t, eid, rn) {
  const d = (((t.endpoints || {})[eid] || {}).rungs || {})[rn];
  return d ? d[st.metric] ?? null : null;
}

/* One step of a chain, measured on this target at this rung. */
function stepDelta(t, step, rn) {
  const arm = epValue(t, step.arm, rn), base = epValue(t, step.base, rn);
  if (arm == null || base == null) return null;
  const d = arm - base;
  return {...step, arm_v: arm, base_v: base, d,
          measurable: Math.abs(d) >= floorFor(arm, base)};
}

/* The whole chain plus its total. `null` when the endpoint is a root, or when the run is
   missing either end: an endpoint the spec pairs but this run never measured has no
   delta rather than a delta against nothing. */
function deltaFor(t, eid, rn) {
  const steps = chainOf(eid).map(s => stepDelta(t, s, rn));
  if (!steps.length || steps.some(s => s === null)) return null;
  const root = steps[steps.length - 1].base;
  const arm = steps[0].arm_v, base = steps[steps.length - 1].base_v;
  const total = arm - base;
  return {steps, root, arm_v: arm, base_v: base, total,
          measurable: Math.abs(total) >= floorFor(arm, base)};
}

const unitSuffix = () => METRICS[st.metric].unit ? ' ' + METRICS[st.metric].unit : '';
const signed = v => (v > 0 ? '+' : v < 0 ? '−' : '±') +
                    Math.round(Math.abs(v)).toLocaleString() + unitSuffix();

/* The cell shown in a table: the number, and grey with the reason when it is smaller than
   the instrument can see. */
/* Takes either a whole chain, whose delta is `total` against `root`, or one of its steps,
   whose delta is `d` against `base`. */
function deltaCell(x) {
  if (!x) return `<td class="delta root" title="This endpoint carries no base.">&mdash;</td>`;
  const v = x.total ?? x.d, against = x.root ?? x.base;
  const state = !x.measurable ? 'flat' : v > 0 ? 'up' : 'down';
  const why = x.measurable ? `${signed(v)} over ${against}`
    : `${signed(v)} is inside the ${Math.round(floorFor(x.arm_v, x.base_v))}` +
      `${unitSuffix()} the histogram can resolve at this magnitude, so this factor adds ` +
      `no measurable time`;
  return `<td class="delta ${state}" title="${esc(why)}">${signed(v)}</td>`;
}

function childTable(caption, kids, level) {
  if (!kids.length) return `<p class="empty">Nothing at this level for this target.</p>`;
  const withRoute = level === 'endpoint';
  /* Cut the route here rather than in CSS: the table is auto-layout, so a max-width on a
     cell is advisory and query.many's eight parameters would widen the whole dialog. */
  const clip = (s, n) => s.length > n ? s.slice(0, n - 1) + '\u2026' : s;
  const routeCell = (id) => {
    if (!withRoute) return '';
    const r = routeOf(id);
    if (!r) return '<td class="l route">&mdash;</td>';
    return `<td class="l route" title="${esc(r.m + ' ' + r.p)}">` +
           `<span class="verb">${esc(r.m)}</span> ${esc(clip(r.p, 44))}</td>`;
  };
  const body = kids.map(k => {
    const route = routeCell(k.id);
    return `
    <tr data-down="${esc(level)}" data-id="${esc(k.id)}">
      <td class="l name">${esc(k.id)}</td>${route}
      ${withRoute ? '' : `<td class="sub">${k.eps}</td>`}
      <td>${cell('value', k.value)}</td>
      ${withRoute ? deltaCell(k.delta) : ''}
      <td class="sub">${k.n == null ? '&mdash;' : Math.round(k.n).toLocaleString()}</td>
      <td class="sub go">open &rarr;</td>
    </tr>`;
  }).join('');
  return `<h3 class="childcap">${esc(caption)}</h3>
    <div class="scroll childscroll"><table><thead><tr>
      <th class="l">${withRoute ? 'endpoint' : 'family'}</th>
      ${withRoute ? '<th class="l">route</th>' : '<th>endpoints</th>'}
      <th>${esc(METRICS[st.metric].label)}</th>
      ${withRoute ? '<th title="Against the root of this endpoint\'s base chain">over base</th>' : ''}
      <th>samples</th><th></th>
    </tr></thead><tbody>${body}</tbody></table></div>`;
}

/* What this endpoint costs over its base, one row per factor, ending in the total over the
   root. The rows sum to the total exactly, because every one of them is a difference of
   two numbers on this page and the middles cancel. */
function chainTable(x) {
  if (!x) return '';
  const reads = (RB.factors || {});
  const rows = x.steps.map(s => `
    <tr>
      <td class="l factor">${esc(s.factor || '')}</td>
      <td class="l reads">${esc(reads[s.factor] || '')}</td>
      <td class="step">${Math.round(s.base_v).toLocaleString()} → ${Math.round(s.arm_v).toLocaleString()}</td>
      ${deltaCell(s)}
    </tr>`).join('');
  const total = `
    <tr class="total">
      <td class="l factor"></td>
      <td class="l reads">everything over ${esc(x.root)}</td>
      <td class="step">${Math.round(x.base_v).toLocaleString()} → ${Math.round(x.arm_v).toLocaleString()}</td>
      ${deltaCell(x)}
    </tr>`;
  /* Named once under the table rather than per row, because on most endpoints it applies
     to every row or to none. */
  const flat = x.steps.filter(s => !s.measurable).map(s => s.factor);
  const note = flat.length ? `<p class="nofloor">${esc(flat.join(', '))} ` +
      `${flat.length === 1 ? 'adds' : 'add'} no measurable time: the difference is smaller ` +
      `than the 2% buckets the histogram is read off, so what it shows is the grid.</p>` : '';
  return `<h3 class="childcap">What it costs over its base</h3>
    <div class="scroll"><table class="chain"><thead><tr>
      <th class="l">factor</th><th class="l">what it adds</th>
      <th>${esc(METRICS[st.metric].label)}</th><th>delta</th>
    </tr></thead><tbody>${rows}${total}</tbody></table></div>${note}`;
}

function crumbs(t) {
  const parts = [`<button data-up="blend">${esc(t.target)}</button>`];
  if (dlgAt.family) parts.push(`<button data-up="family">${esc(dlgAt.family)}</button>`);
  if (dlgAt.endpoint) parts.push(`<span>${esc(dlgAt.endpoint)}</span>`);
  return `<nav class="crumbs">${parts.join('<i>›</i>')}</nav>`;
}

async function openDetail(key) {
  const r = (window.__rows || []).find(x => x.key === key);
  if (!r) return;
  dlgAt = {language: r.language, target: r.target,
           family: st.gran === 'family' ? r.detail
                 : st.gran === 'endpoint' ? r.family : null,
           endpoint: st.gran === 'endpoint' ? r.detail : null};
  await paintDetail();
  document.getElementById('dlg').showModal();
}

async function paintDetail() {
  const run = latest(); if (!run || !dlgAt) return;
  const t = run.targets.find(x => x.language === dlgAt.language && x.target === dlgAt.target);
  if (!t) return;
  const rn = pickRung(run);
  const tkey = dlgAt.language + ':' + dlgAt.target;
  const box = document.getElementById('dlgbody');
  const head = `
    <div class="wirehead"><strong>${esc(t.framework || t.target)}</strong>
      <span class="ver">${esc(t.version || '')}</span>
      <span class="wmeta">${esc(t.language)}</span>
      ${(RB.pages || {})[tkey] ? `<a class="fwlink" href="${esc(RB.pages[tkey])}">README &amp; bundle &rarr;</a>` : ''}</div>
    ${crumbs(t)}`;

  if (!dlgAt.endpoint) {
    const kids = dlgAt.family ? epRowsFor(run, t, rn, dlgAt.family) : famRowsFor(run, t, rn);
    const self = dlgAt.family ? (famsAt(t, rn)[dlgAt.family] || {})
                              : (t.rungs || {})[rn] || {};
    box.innerHTML = head + `
      <div class="fields">
        <div class="frow"><span class="fk">${esc(METRICS[st.metric].label)}</span><span class="fv">${cell('value', self[st.metric] ?? self.p50_us)}</span></div>
        <div class="frow"><span class="fk">samples</span><span class="fv">${cell('', self.count ?? self.achieved_rps)}</span></div>
      </div>` +
      childTable(dlgAt.family ? `Endpoints in ${dlgAt.family}` : 'Families', kids,
                 dlgAt.family ? 'endpoint' : 'family');
    return;
  }

  /* the leaf: this endpoint's handler, then what it actually put on the wire */
  const eid = dlgAt.endpoint;
  const d = (((t.endpoints || {})[eid] || {}).rungs || {})[rn] || {};
  const stat = (lab, k, u) => `<div class="frow"><span class="fk">${esc(lab)}</span><span class="fv">${cell(u, d[k])}</span></div>`;
  const route = routeOf(eid);
  box.innerHTML = head + `
    ${route ? `<p class="leafroute"><span class="verb">${esc(route.m)}</span> ${esc(route.p)}</p>` : ''}
    <div class="fields">
      ${stat('p50', 'p50_us', 'value')}${stat('p90', 'p90_us', 'value')}
      ${stat('p99', 'p99_us', 'value')}${stat('p99.9', 'p999_us', 'value')}
      ${stat('samples', 'count', '')}
    </div>
    ${chainTable(deltaFor(t, eid, rn))}
    <p class="empty" id="leafload">Loading the handler and the captured exchange…</p>`;

  const [codeDoc, wireKey] = [await fetchCode(tkey), wireKeyFor({language: dlgAt.language, target: dlgAt.target})];
  if (wireKey) await fetchWire(wireKey);
  const wdoc = wireKey ? wireCache.get(wireKey) : null;
  const sn = codeDoc && codeDoc[eid];
  const e = wdoc && wdoc.endpoints[eid];
  const loc = sn ? `${sn.f}:${sn.s}${sn.e === sn.s ? '' : '-' + sn.e}` : '';
  const handler = sn ? `
    <h3 class="childcap">Handler</h3>
    <div class="sniphead"><span class="loc">${esc(loc)}</span><span class="how">${esc(sn.h)}</span>
      ${sn.u ? `<a href="${esc(sn.u)}">open on GitHub &rarr;</a>`
             : `<span class="how">commit not on a remote, so no link</span>`}</div>
    <pre class="code">${esc(sn.t)}</pre>`
    : `<p class="empty">No handler located for this endpoint in this target.</p>`;
  const hdr = hs => hs.map(([k, v]) =>
    `<div class="hrow"><span class="hk">${esc(k)}</span><span class="hv">${esc(v)}</span></div>`).join('');
  const exchange = e ? `
    <h3 class="childcap">On the wire</h3>
    <div class="wirecols">
      <div><h3>Request</h3>
        <pre class="wire req">${esc(e.m)} ${esc(e.p)}</pre>
        <div class="hdrs">${hdr(e.rh)}</div>
        ${e.rb ? `<pre class="wire">${esc(e.rb)}${e.rbz > 700 ? '\n… ' + e.rbz.toLocaleString() + ' bytes total' : ''}</pre>` : '<p class="empty" style="padding:6px 0">no body</p>'}
      </div>
      <div><h3>Response</h3>
        <pre class="wire res">HTTP ${e.s}</pre>
        <div class="hdrs">${hdr(e.sh)}</div>
        ${e.sb ? `<pre class="wire">${esc(e.sb)}${e.tr ? '\n… ' + e.sbz.toLocaleString() + ' bytes total' : ''}</pre>` : '<p class="empty" style="padding:6px 0">no body</p>'}
      </div>
    </div>` : '';
  const load = document.getElementById('leafload');
  if (load) load.outerHTML = handler + exchange;
}

/* ---- the time axis ---- */
function renderTime(rs, langColour) {
  const runs = runsForHost();
  const el = document.getElementById('time');
  // The history needs every run on this host, not just the embedded newest one.
  if (manifest.some(m => m.exec_host === st.host && !loaded.has(m.id))) {
    el.innerHTML = '<p class="empty">Loading history\u2026</p>';
    fetchHostRuns(st.host).then(got => { if (got) render(); });
    return;
  }
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
      const base = t.language + ':' + t.target;
      keys.forEach(k => {
        const [kb, det] = k.split('|');
        if (kb !== base) return;
        let v = null;
        if (!det) { const d = t.rungs[rn]; v = d ? d[st.metric] : null; }
        else if ((t.endpoints || {})[det]) {
          const d = (t.endpoints[det].rungs || {})[rn]; v = d ? d[st.metric] : null;
        } else {
          const fams = famsAt(t, rn);
          v = fams[det] ? fams[det][st.metric] : null;
        }
        if (v == null) return;
        if (!series.has(k)) series.set(k, []);
        series.get(k).push({date: run.date, v, ver: t.version || '', adapter: t.adapter || ''});
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
    let prev = null, prevAd = null;
    pts.forEach((pt, i) => {
      const newVer = prev !== null && pt.ver && pt.ver !== prev;
      const newAd = prevAd !== null && pt.adapter !== prevAd;
      const changed = newVer || newAd;
      const label = newVer ? pt.ver : 'via ' + pt.adapter.split(' ').pop();
      prev = pt.ver || prev;
      prevAd = pt.adapter;
      const anchor = i === 0 ? 'start' : i >= n - 1 ? 'end' : 'middle';
      g += changed
        ? `<circle cx="${X(i).toFixed(1)}" cy="${Y(pt.v).toFixed(1)}" r="5.5" fill="var(--surface)" stroke="${c}" stroke-width="2"/><text x="${X(i).toFixed(1)}" y="${(Y(pt.v) - 11).toFixed(1)}" fill="${c}" font-size="9" font-family="var(--f-mono)" text-anchor="${anchor}">${esc(label)}</text>`
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
    '<span style="color:var(--ink3)">hollow ring = new framework or adapter version</span></div>';
}

/* ---- wiring ---- */
document.getElementById('host').onchange = async (e) => {
  st.host = e.target.value; st.rung = null; render();
  if (await fetchHostRuns(st.host)) render();
};
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
/* Drilling happens inside the dialog, so one delegated handler covers both directions. */
document.getElementById('dlgbody').onclick = e => {
  const down = e.target.closest('tr[data-down]');
  if (down) {
    if (down.dataset.down === 'family') dlgAt.family = down.dataset.id;
    else dlgAt.endpoint = down.dataset.id;
    paintDetail();
    document.getElementById('dlgbody').scrollTop = 0;
    return;
  }
  const up = e.target.closest('button[data-up]');
  if (up) {
    if (up.dataset.up === 'blend') { dlgAt.family = null; dlgAt.endpoint = null; }
    else dlgAt.endpoint = null;
    paintDetail();
  }
};
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
  readHash();
render();
// Pull the rest of this host's runs in the background so the history fills in.
fetchHostRuns(st.host).then(got => { if (got) render(); });
});
const _writeHash = writeHash;
writeHash = function () { _writeHash(); ownHash = location.hash; };
readHash(); render();
"""


def slug(run_id):
    return run_id.replace(":", "").replace("/", "-")


def manifest_entry(r):
    """Just enough to populate the controls and decide what to fetch."""
    return {"id": r["run_id"], "file": "data/%s.json.gz" % slug(r["run_id"]),
            "date": r.get("date", ""), "languages": r.get("languages") or [],
            "exec_host": r.get("exec_host") or "container",
            "suite": r.get("suite", ""), "tracked": bool(r.get("tracked")),
            "cpu": r.get("cpu", ""), "cores": r.get("cores", 0)}


def snippet_doc(run, view):
    """Every endpoint's handler for one target: the code, and where it came from.

    Short keys, because this ships to the browser next to the run it describes.
    """
    out = {}
    for eid, sn in view["snippets"].items():
        url = None
        if view["linkable"] and run.get("repo"):
            url = permalink(run["repo"], run["commit"], sn["path"],
                            sn["start_line"], sn["end_line"])
        out[eid] = {"f": sn["path"], "s": sn["start_line"], "e": sn["end_line"],
                    "h": sn["how"], "u": url, "t": sn["text"]}
    return out


def render(runs, wire, pages=None, code=None):
    tracked = [r for r in runs if r.get("tracked")]
    pages = pages or {}
    code = code or {}
    now = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    # Which endpoint sets the page is showing, read from the runs rather than written here:
    # a hardcoded name kept saying blend-v1 for a page built entirely from blend-v2 runs.
    suites = sorted({r["suite"] for r in tracked if r.get("suite")})
    epochs = sorted({str(r["epoch"]) for r in tracked if r.get("epoch")})
    # Embed only the newest tracked run per host, so the table paints without a round trip.
    # Everything else is fetched when something actually needs it; embedding every run made
    # the page grow without bound, one full-matrix run being close to a megabyte.
    newest = {}
    for r in tracked:
        h = r.get("exec_host") or "container"
        if h not in newest or r["run_id"] > newest[h]["run_id"]:
            newest[h] = r
    # Wire captures are per target and only read when a dialog opens, so ship the index
    # and fetch the bodies. Embedding all of them was most of the page weight.
    spec = read_spec()
    data = json.dumps({
        "runs": list(newest.values()),
        "manifest": [manifest_entry(r) for r in runs],
        "hosts": host_notes(),
        "routes": spec_routes(spec),
        "factors": spec_factors(spec),
        "pages": pages,
        "codeIndex": {k: "data/code/%s.json.gz" % k.replace(":", "-") for k in code},
        "wireIndex": {k: {"framework": v["framework"], "version": v["version"],
                          "file": "data/wire/%s.json.gz" % k}
                      for k, v in wire.items()},
    }, separators=(",", ":"))
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

<p class="eyebrow">__SUITES__ &middot; built __BUILT__</p>
<h1>RequestBench Results</h1>
<p class="lede">Every framework in a run shares one machine and one window, so these are
real latencies and they rank directly against each other. Nothing here is divided by
anything: what a target took is what is shown.</p>

<div class="controls">
  <div class="ctl"><label for="host">Execution host</label>
    <select id="host"></select></div>
  <div class="ctl"><label for="rung" id="runglabel">Offered rate</label>
    <select id="rung"></select></div>
  <div class="ctl"><label for="metric">Metric</label>
    <select id="metric">
      <option value="p50_us">p50</option>
      <option value="p90_us">p90</option>
      <option value="p99_us">p99</option>
      <option value="p999_us">p99.9</option>
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

<div class="note" id="hostnote" style="display:none"></div>
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

<div class="note">Each row is the time that target took at the offered rate, on the
machine and in the window named above. A target that could not sustain a rate has no
latency at it: percentiles over the requests that survived would flatter the collapse,
so what it achieved and what it dropped is shown instead.</div>

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
            .replace("__SUITES__", "%s &middot; epoch %s" % (esc(" + ".join(suites)),
                                                              esc(", ".join(epochs)))
                     if suites else "no runs")
            .replace("__DATA__", data).replace("__APP__", app))


# ---------------------------------------------------------------------------------------
# Framework pages: docs/bundles.html §6. One page per target in the newest run on a host,
# rendered from the bundle manifest at the commit that run recorded rather than from the
# working tree, so a page about a run made in March shows the code that ran in March.

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "harness"))
import bundle, snippets                                            # noqa: E402

FW_CSS = """
.crumb { font-family: var(--f-mono); font-size: 11.5px; margin: 0 0 18px; }
.ident { display: flex; gap: 16px; align-items: center; margin: 0 0 6px; }
.mono-mark { width: 54px; height: 54px; border-radius: 6px; flex: none;
             background: var(--surface2); border: 1px solid var(--rule2);
             display: flex; align-items: center; justify-content: center;
             font-family: var(--f-display); font-size: 26px; font-weight: 600;
             color: var(--tealtext); }
.ident h1 { margin: 0; }
.factline { font-family: var(--f-mono); font-size: 12px; color: var(--ink2);
            margin: 0 0 4px; display: flex; flex-wrap: wrap; gap: 6px 14px; }
.verdict { font-family: var(--f-mono); font-size: 11px; letter-spacing: .06em;
           text-transform: uppercase; padding: 2px 8px; border-radius: 2px; }
.verdict.ok { background: var(--tealsoft); color: var(--tealtext); }
.verdict.no { background: var(--surface2); color: var(--amber); }
.prose > * { max-width: 72ch; }
.prose > h2:first-child { margin-top: 0; }
.prose h2 { font-family: var(--f-display); font-size: 19px; margin: 22px 0 6px; }
.prose p { margin: 0 0 11px; }
.prose ul { margin: 0 0 11px; padding-left: 20px; }
.prose code { background: var(--surface2); padding: 1px 4px; border-radius: 2px;
              font-size: 12.5px; }
.sniphead { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: baseline;
            font-family: var(--f-mono); font-size: 11.5px; margin: 0 0 6px; }
.sniphead .loc { color: var(--ink3); }
pre.code { font-family: var(--f-mono); font-size: 12px; line-height: 1.55; margin: 0;
           background: var(--surface); border: 1px solid var(--rule);
           border-left: 2px solid var(--teal); border-radius: 0 3px 3px 0;
           padding: 11px 14px; overflow-x: auto; white-space: pre; }
.how { font-family: var(--f-mono); font-size: 10px; letter-spacing: .08em;
       text-transform: uppercase; color: var(--ink3); }
td.path { font-family: var(--f-mono); font-size: 12px; }
td.h { font-family: var(--f-mono); font-size: 11px; color: var(--ink3); }

/* ---- endpoint explorer: tree picks, pane describes ---- */
.explorer { display: grid; grid-template-columns: minmax(210px, 264px) 1fr; gap: 26px;
            align-items: start; }
@media (max-width: 860px) { .explorer { grid-template-columns: 1fr; } }
.eptree { position: sticky; top: 16px; max-height: calc(100vh - 32px); overflow-y: auto;
          border-right: 1px solid var(--rule); padding-right: 14px; }
@media (max-width: 860px) {
  .eptree { position: static; max-height: 340px; border-right: none;
            border-bottom: 1px solid var(--rule); padding: 0 0 12px; } }
.eptree ul { list-style: none; margin: 0; padding: 0; }
.eptree .epfam + .epfam { margin-top: 12px; }
.epfamname { display: block; font-family: var(--f-mono); font-size: 10px;
             letter-spacing: .1em; text-transform: uppercase; color: var(--ink3);
             margin: 0 0 4px; }
.eplink { display: block; text-decoration: none; color: var(--ink2); padding: 4px 8px;
          border-radius: 3px; border-left: 2px solid transparent; }
.eplink:hover { background: var(--surface2); }
.eplink[aria-current="true"] { background: var(--tealsoft); border-left-color: var(--teal);
                               color: var(--ink); }
.epid { display: block; font-family: var(--f-mono); font-size: 12.5px; }
.eproute { display: block; font-family: var(--f-mono); font-size: 10.5px;
           color: var(--ink3); white-space: nowrap; overflow: hidden;
           text-overflow: ellipsis; }
.eplink[aria-current="true"] .eproute { color: var(--ink2); }
.eppanes { min-width: 0; }
.eppane .epname { font-family: var(--f-mono); font-size: 17px; margin: 0; }
/* .fields draws its hairlines by showing a rule-coloured background through a 1px gap,
   so an unfilled track at the end of a wrapped row reads as an empty grey cell. Outlines
   overlap in the gap instead, which leaves the unfilled area the surface colour. */
.eppane .fields { margin-bottom: 4px; background: var(--surface); border: none; }
.eppane .frow { outline: 1px solid var(--rule); }
.eppane pre.code { max-height: 460px; overflow: auto; }
"""


def monogram(name):
    return esc(name[0].upper())


def md(text):
    """The bundle's README, as much of Markdown as these files actually use.

    A dependency would be a build-time install for headings, paragraphs, lists and fenced
    code, and the gate in validate.yml is what keeps the files to that subset.
    """
    lines = text.splitlines()
    # The page already carries the framework's name as its heading, so a README that opens
    # with one would print it twice.
    if lines and lines[0].startswith("# "):
        lines = lines[1:]
    out, i = [], 0
    def inline(s):
        s = esc(s)
        s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
        s = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", s)
        return s
    while i < len(lines):
        line = lines[i]
        if line.startswith("```"):
            body = []
            i += 1
            while i < len(lines) and not lines[i].startswith("```"):
                body.append(lines[i])
                i += 1
            out.append("<pre class='code'>%s</pre>" % esc("\n".join(body)))
        elif line.startswith("#"):
            depth = len(line) - len(line.lstrip("#"))
            out.append("<h%d>%s</h%d>" % (min(depth + 1, 4), inline(line.lstrip("# ")),
                                          min(depth + 1, 4)))
        elif line.strip().startswith(("- ", "* ")):
            items = []
            while i < len(lines) and lines[i].strip().startswith(("- ", "* ")):
                items.append("<li>%s</li>" % inline(lines[i].strip()[2:]))
                i += 1
            out.append("<ul>%s</ul>" % "".join(items))
            continue
        elif line.strip():
            para = []
            while i < len(lines) and lines[i].strip() and not lines[i].startswith(("#", "```")):
                para.append(lines[i].strip())
                i += 1
            out.append("<p>%s</p>" % inline(" ".join(para)))
            continue
        i += 1
    return "\n".join(out)


def permalink(repo, commit, path, start, end):
    """blob rather than raw, so the reader gets highlighting and can browse outward, and
    the full SHA rather than a branch, so a link from a run in March still opens March's
    code. A one-line range is #L30, which is what GitHub's own copy-link produces."""
    frag = "#L%d" % start if start == end else "#L%d-L%d" % (start, end)
    return "https://github.com/%s/blob/%s/%s%s" % (repo, commit, path, frag)


def bundle_at(run, t):
    """The target's manifest and snippets at the commit this run measured.

    Returns None when history cannot answer: a shallow checkout, a rewritten branch, or a
    rollup that does not match what the run recorded. Rendering today's file under an old
    number is the failure this whole mechanism exists to prevent, so nothing is guessed.
    """
    commit, language, target = run.get("commit"), t["language"], t["target"]
    if not commit:
        return None
    try:
        man = bundle.manifest(language, target, at=commit)
        snips, problems = snippets.resolve(language, target, at=commit)
    except Exception:
        return None
    recorded = t.get("bundle_hash")
    verified = bool(recorded) and man["bundle_hash"] == recorded
    return {"manifest": man, "snippets": snips, "problems": problems, "verified": verified,
            "linkable": verified and bundle.pushed(commit)}


def standing(run, t, rn):
    """This target's own row, and where it sits among the rows it is comparable to."""
    row = (t.get("rungs") or {}).get(str(rn)) or {}
    peers = [x for x in run["targets"]
             if x["language"] == t["language"] and (x.get("rungs") or {}).get(str(rn))]
    ordered = sorted(peers, key=lambda x: x["rungs"][str(rn)].get("p50_us") or 0)
    rank = next((i + 1 for i, x in enumerate(ordered) if x["target"] == t["target"]), None)
    return row, rank, len(ordered)


# The same rule the explorer's delta column applies, written a second time because a
# framework page is rendered here and the column is rendered in the browser. These are the
# JS constants of the same name, and changing one without the other would leave two pages
# disagreeing about one subtraction.
BUCKET, FLOOR_BUCKETS = 0.02, 2


def base_chain(eid, routes, own, rn):
    """Every step from this endpoint down to the root of its base chain, on this target.

    None when the endpoint is a root, and None when this run did not measure every endpoint
    in the chain: a step against a number that is not there is a step against nothing.

    p50 and not the selected metric, because a framework page is rendered once and has no
    metric selector; the panel it feeds is headed p50 for the same reason.
    """
    def at(i):
        return (((own.get(i) or {}).get("rungs") or {}).get(rn) or {}).get("p50_us")

    steps, cur = [], eid
    while len(steps) < 16:                    # harness/plan.py rejects a cycle; this is the belt
        r = routes.get(cur) or {}
        if not r.get("b"):
            break
        arm, base = at(cur), at(r["b"])
        if arm is None or base is None:
            return None
        steps.append({"factor": r.get("v", ""), "base_id": r["b"],
                      "base": base, "arm": arm, "d": arm - base})
        cur = r["b"]
    if not steps:
        return None
    return {"steps": steps, "root": cur, "base": steps[-1]["base"], "arm": steps[0]["arm"],
            "total": steps[0]["arm"] - steps[-1]["base"]}


def resolves(d, a, b):
    """Whether a difference of two percentiles is larger than the grid they were read off."""
    return abs(d) >= BUCKET * FLOOR_BUCKETS * max(abs(a), abs(b))


def chain_panel(chain, factors):
    """What this endpoint costs over its base, one row per factor, ending in the total."""
    if not chain:
        return ""

    def row(factor, reads, base, arm, d, cls=""):
        state = "up" if d > 0 else "down" if d < 0 else "flat"
        if not resolves(d, arm, base):
            state = "flat"
        sign = "+" if d > 0 else "&minus;" if d < 0 else "&plusmn;"
        return ("<tr class='%s'><td class='l factor'>%s</td><td class='l reads'>%s</td>"
                "<td class='step'>%s &rarr; %s</td><td class='delta %s'>%s%s&nbsp;us</td></tr>"
                % (cls, esc(factor), esc(reads), f"{base:,}", f"{arm:,}", state, sign,
                   f"{abs(d):,}"))

    rows = "".join(row(s["factor"], factors.get(s["factor"], ""),
                       s["base"], s["arm"], s["d"]) for s in chain["steps"])
    rows += row("", "everything over %s" % chain["root"], chain["base"], chain["arm"],
                chain["total"], cls="total")
    flat = [s["factor"] for s in chain["steps"] if not resolves(s["d"], s["arm"], s["base"])]
    note = ("<p class='nofloor'>%s %s no measurable time: the difference is smaller than "
            "the 2%% buckets the histogram is read off, so what it shows is the grid.</p>"
            % (esc(", ".join(flat)), "adds" if len(flat) == 1 else "add")) if flat else ""
    return ("<h3>What it costs over its base</h3>"
            "<div class='scroll'><table class='chain'><thead><tr><th class='l'>factor</th>"
            "<th class='l'>what it adds</th><th>p50</th><th>delta</th></tr></thead>"
            "<tbody>%s</tbody></table></div>%s" % (rows, note))


def render_endpoint(eid, route, d, sn, ex, also, linkable, repo, commit, chain, factors):
    """One endpoint's pane: what it answers, what it cost, how it is wired, what it sent."""
    def us(v):
        return "&mdash;" if v is None else "%s&nbsp;us" % f"{v:,}"

    def count(v):
        return "&mdash;" if v is None else f"{v:,}"

    # p95 is in summaries written after harness/summarize.py started recording it. An
    # older one carries p90, and the pane says p90 rather than labelling it p95.
    tail = ("p95", d.get("p95_us")) if "p95_us" in d else ("p90", d.get("p90_us"))
    stats = [("p50", us(d.get("p50_us"))), (tail[0], us(tail[1])),
             ("p99", us(d.get("p99_us"))), ("p99.9", us(d.get("p999_us"))),
             ("samples", count(d.get("count")))]
    for label in ("errors", "mismatch"):
        if d.get(label):
            stats.append((label, count(d[label])))
    fields = "".join("<div class='frow'><span class='fk'>%s</span>"
                     "<span class='fv'>%s</span></div>" % (k, v) for k, v in stats)
    perf = ("<div class='fields'>%s</div>" % fields if d else
            "<p class='empty'>Not measured at this rate.</p>")
    perf += chain_panel(chain, factors)

    if sn:
        loc = "%s:%d%s" % (sn["path"], sn["start_line"],
                           "" if sn["end_line"] == sn["start_line"]
                           else "-%d" % sn["end_line"])
        anchor = ""
        if linkable:
            anchor = ("<a href='%s'>open on GitHub &rarr;</a>"
                      % esc(permalink(repo, commit, sn["path"],
                                      sn["start_line"], sn["end_line"])))
        # One registration often answers a whole family. Naming the rest here is what the
        # old deduplicated list was protecting: without it the same block appears under
        # six endpoints with nothing to say they are one call.
        together = ("<p class='hint'>The same registration answers %s.</p>"
                    % esc(", ".join(also)) if also else "")
        impl = ("<div class='sniphead'><span class='loc'>%s</span>"
                "<span class='how'>%s</span>%s</div>%s<pre class='code'>%s</pre>"
                % (esc(loc), esc(sn["how"]), anchor, together, esc(sn["text"])))
    else:
        impl = "<p class='empty'>No handler located for this endpoint.</p>"

    if ex:
        def hdrs(hs):
            return "".join("<div class='hrow'><span class='hk'>%s</span>"
                           "<span class='hv'>%s</span></div>" % (esc(k), esc(v))
                           for k, v in hs)

        def body_of(text, total, truncated):
            if not text:
                return "<p class='empty'>no body</p>"
            more = "\n&hellip; %s bytes total" % f"{total:,}" if truncated else ""
            return "<pre class='wire'>%s%s</pre>" % (esc(text), more)

        payload = (
            "<div class='wirecols'>"
            "<div><h3>Request</h3><pre class='wire req'>%s %s</pre>"
            "<div class='hdrs'>%s</div>%s</div>"
            "<div><h3>Response</h3><pre class='wire res'>HTTP %s</pre>"
            "<div class='hdrs'>%s</div>%s</div></div>"
            % (esc(ex["m"]), esc(ex["p"]), hdrs(ex["rh"]),
               body_of(ex["rb"], ex["rbz"], ex["rbz"] > 700),
               esc(str(ex["s"])), hdrs(ex["sh"]),
               body_of(ex["sb"], ex["sbz"], ex["tr"])))
    else:
        payload = ("<p class='empty'>No captured exchange for this target. Exemplars are "
                   "written by <code>make exemplars</code> and only for the targets it "
                   "has been run against.</p>")

    return ("<section class='eppane' data-ep='%s' hidden>"
            "<h2 class='epname'>%s</h2>"
            "<p class='leafroute'><span class='verb'>%s</span> %s</p>"
            "<h3 class='childcap'>Performance</h3>%s"
            "<h3 class='childcap'>Implementation</h3>%s"
            "<h3 class='childcap'>On the wire</h3>%s</section>"
            % (esc(eid), esc(eid), esc(route.get("m", "")), esc(route.get("p", "")),
               perf, impl, payload))


def render_framework(run, t, rn, view, wire, routes, factors):
    name = t.get("framework") or t["target"]
    row, rank, n_peers = standing(run, t, rn)
    facts = ["%s %s" % (name, t.get("version") or "?"), t.get("target_runtime") or ""]
    for label in ("adapter", "serializer", "template"):
        if t.get(label):
            facts.append("%s %s" % (label, t[label]))
    head = ["<p class='crumb'><a href='../index.html'>&larr; results</a></p>",
            "<div class='ident'><div class='mono-mark'>%s</div><h1>%s</h1></div>"
            % (monogram(name), esc(name)),
            "<p class='factline'>%s</p>"
            % " &middot; ".join(esc(f) for f in facts if f)]

    commit = run.get("commit") or ""
    if view and view["verified"] and view["linkable"]:
        verdict = ("<span class='verdict ok'>hash verified</span> against "
                   "<code>%s</code>" % esc(commit[:12]))
    elif view and view["verified"]:
        verdict = ("<span class='verdict ok'>hash verified</span> against "
                   "<code>%s</code>, which is not on a remote, so the code is shown "
                   "without links" % esc(commit[:12]))
    elif view and not t.get("bundle_hash"):
        # A run made before the bundle fields existed has nothing to verify against. That
        # is not a mismatch, and reading as one would accuse the history of being wrong.
        verdict = ("<span class='verdict no'>no bundle recorded</span> this run predates "
                   "the bundle record, so its source cannot be pinned")
    elif view:
        verdict = ("<span class='verdict no'>hash mismatch</span> the bundle at "
                   "<code>%s</code> is not what this run recorded, so no source is linked"
                   % esc(commit[:12]))
    else:
        verdict = ("<span class='verdict no'>source unavailable</span> this run recorded "
                   "no commit, or history here does not hold it")
    head.append("<p class='factline'>%s</p>" % verdict)

    body = []
    prose = ""
    if view:
        # The target's own README, not any prose the bundle happens to sweep in. The shared
        # host note is in every Node bundle, and matching it put a page about the host
        # contract under every framework's name.
        want = "targets/%s/%s/README.md" % (t["language"],
                                            bundle.target_dir(t["target"]))
        if any(e["path"] == want for e in view["manifest"]["files"]):
            try:
                prose = bundle.blob(want, commit).decode("utf-8")
            except Exception:
                prose = ""
    if prose:
        body.append("<div class='panel prose'>%s</div>" % md(prose))
    else:
        body.append("<div class='note'>No README in this target's bundle yet. The prose is "
                    "the hand-written half of docs/bundles.html &sect;2 and is what says "
                    "how this framework is wired here.</div>")

    if row:
        # A rate the target did not complete has no latency to state, so the line says what
        # it achieved and what it lost instead of formatting a None.
        p50 = row.get("p50_us")
        offered = (row.get("offered_rps") or 0) * (row.get("seconds") or 0)
        took = ("p50 %s&nbsp;us" % f"{p50:,}") if p50 is not None else (
            "did not sustain the rate, dropping %.1f%%"
            % (100 * row.get("dropped", 0) / offered if offered else 0))
        body.append(
            "<div class='panel'><h2>Standing</h2>"
            "<p class='hint'>At %s offered rps, in the run that produced this page.</p>"
            "<p class='factline'>%s &middot; rank %s of %s in %s"
            " &middot; %s achieved rps</p></div>"
            % (f"{row.get('offered_rps', 0):,}", took,
               rank, n_peers, esc(t["language"]), f"{row.get('achieved_rps', 0):,}"))

    # The endpoint explorer: the tree picks one endpoint, the pane describes it. Every
    # pane is in the page rather than fetched, so it works from file:// and a link
    # carrying an endpoint id opens on that endpoint.
    snips = view["snippets"] if view else {}
    order = run.get("endpoint_order") or []
    own = t.get("endpoints") or {}
    fam_of = {eid: rec.get("family", "")
              for t2 in run["targets"] for eid, rec in (t2.get("endpoints") or {}).items()}
    host = run.get("exec_host") or "container"
    ex_eps = ((wire.get("%s-%s@%s" % (t["language"], t["target"], host))
               or wire.get("%s-%s" % (t["language"], t["target"]))
               or {}).get("endpoints") or {})

    serves = {}
    for eid in order:
        sn = snips.get(eid)
        if sn:
            serves.setdefault((sn["path"], sn["start_line"], sn["end_line"]), []).append(eid)

    groups = []
    for eid in order:
        fam = (own.get(eid) or {}).get("family") or fam_of.get(eid, "")
        if not groups or groups[-1][0] != fam:
            groups.append((fam, []))
        groups[-1][1].append(eid)

    linkable = bool(view and view["linkable"] and run.get("repo"))
    tree, panes = [], []
    for fam, eids in groups:
        tree.append("<li class='epfam'><span class='epfamname'>%s</span><ul>" % esc(fam))
        for eid in eids:
            route = routes.get(eid) or {}
            d = ((own.get(eid) or {}).get("rungs") or {}).get(rn) or {}
            sn = snips.get(eid)
            also = []
            if sn:
                at = (sn["path"], sn["start_line"], sn["end_line"])
                also = [o for o in serves[at] if o != eid]
            tree.append("<li><a class='eplink' href='#%s' data-ep='%s'>"
                        "<span class='epid'>%s</span>"
                        "<span class='eproute'><span class='verb'>%s</span> %s</span>"
                        "</a></li>"
                        % (esc(eid), esc(eid), esc(eid),
                           esc(route.get("m", "")), esc(route.get("p", ""))))
            panes.append(render_endpoint(eid, route, d, sn, ex_eps.get(eid), also,
                                         linkable, run.get("repo"), commit,
                                         base_chain(eid, routes, own, rn), factors))
        tree.append("</ul></li>")
    if panes:
        panes[0] = panes[0].replace(" hidden>", ">", 1)
        tree[1] = tree[1].replace("<a class='eplink'",
                                  "<a class='eplink' aria-current='true'", 1)

    if not order:
        body.append("<div class='note'>This run recorded no endpoint order, so there is "
                    "nothing to explore.</div>")
    else:
        missing = [e for e in order if e not in snips]
        note = ("" if not (snips and missing) else
                " No handler located for %s." % esc(", ".join(missing)))
        body.append("<div class='panel'><h2>Endpoints</h2>"
                    "<p class='hint'>%d endpoints in %d families, on the %s host at %s "
                    "offered rps.%s</p>"
                    "<div class='explorer'><nav class='eptree'><ul>%s</ul></nav>"
                    "<div class='eppanes'>%s</div></div></div>"
                    % (len(order), len(groups), esc(host),
                       f"{row.get('offered_rps', 0):,}" if row else "?", note,
                       "".join(tree), "".join(panes)))

    if view:
        frows = []
        for e in view["manifest"]["files"]:
            frows.append("<tr><td class='l h'>%s</td><td class='l path'>%s</td>"
                         "<td class='sub'>%s</td><td class='h'>%s</td></tr>"
                         % (esc(e["role"]), esc(e["path"]), f"{e['bytes']:,}",
                            esc(e["hash"][7:19])))
        body.append("<div class='panel'><h2>Bundle</h2>"
                    "<p class='hint'>%d files, hashed from history at the measured commit. "
                    "code %s &middot; bundle %s</p>"
                    "<div class='scroll'><table><thead><tr><th class='l'>role</th>"
                    "<th class='l'>path</th><th>bytes</th><th>sha256</th></tr></thead>"
                    "<tbody>%s</tbody></table></div></div>"
                    % (len(view["manifest"]["files"]),
                       esc(view["manifest"]["code_hash"][7:19]),
                       esc(view["manifest"]["bundle_hash"][7:19]), "".join(frows)))
        for problem in view["problems"]:
            body.append("<div class='note'>%s</div>" % esc(problem))

    return ("""<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>__NAME__ &middot; RequestBench</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:wght@400;600&family=Archivo:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>__CSS____FWCSS__</style></head><body><div class="page">
__HEAD__
__BODY__
<footer><span><a href="../index.html">github.com/ipjohnson/RequestBench</a></span>
<span>run __RUN__</span></footer>
</div>
<script>
/* The panes are all in the page; the tree only chooses which one is shown. The hash
   carries the choice, so a link to one endpoint opens on it. */
(function () {
  var links = [].slice.call(document.querySelectorAll('.eplink'));
  var panes = [].slice.call(document.querySelectorAll('.eppane'));
  if (!links.length) return;
  function show(id) {
    var hit = false;
    panes.forEach(function (p) { var on = p.dataset.ep === id; p.hidden = !on; hit = hit || on; });
    links.forEach(function (a) { a.setAttribute('aria-current', a.dataset.ep === id ? 'true' : 'false'); });
    return hit;
  }
  links.forEach(function (a) {
    a.addEventListener('click', function (ev) {
      ev.preventDefault();
      history.replaceState(null, '', '#' + a.dataset.ep);
      show(a.dataset.ep);
    });
  });
  var want = decodeURIComponent((location.hash || '').slice(1));
  if (!want || !show(want)) show(links[0].dataset.ep);
  window.addEventListener('hashchange', function () {
    show(decodeURIComponent((location.hash || '').slice(1)));
  });
})();
</script>
</body></html>"""
            .replace("__CSS__", CSS).replace("__FWCSS__", FW_CSS)
            .replace("__NAME__", esc(name))
            .replace("__HEAD__", "\n".join(head))
            .replace("__BODY__", "\n".join(body))
            .replace("__RUN__", esc(run["run_id"])))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--summaries", default="results/summary")
    ap.add_argument("--exemplars", default="results/exemplars")
    ap.add_argument("--out", default="site/dist")
    a = ap.parse_args()
    runs = load(a.summaries)
    wire = load_exemplars(a.exemplars)
    spec = read_spec()
    routes, factors = spec_routes(spec), spec_factors(spec)
    # An exemplar captured against an older blend carries endpoint ids nothing in the run
    # matches, so every payload pane comes out empty with nothing on the page to say why.
    # That is how blend-v1 captures survived the move to blend-v2 unnoticed.
    known = {eid for r in runs if r.get("tracked")
             for eid in (r.get("endpoint_order") or [])}
    stale = sorted(k for k, v in wire.items()
                   if known and not set(v["endpoints"]) & known)
    if stale:
        print("  %d exemplar capture(s) match no endpoint in any run and will show no "
              "payload; recapture with `make exemplars`: %s" % (len(stale),
                                                               ", ".join(stale)))
    out = pathlib.Path(a.out)
    out.mkdir(parents=True, exist_ok=True)

    # A framework page describes one target as one run measured it, and its name carries
    # no host, so it is generated from the container host alone. Generating every host
    # into the same name meant the last one written won: go-gin's page reported lambda-rie,
    # a host with no HTTP in the process. The other hosts need a name of their own before
    # they can have a page.
    newest = None
    for r in runs:
        if not r.get("tracked") or (r.get("exec_host") or "container") != "container":
            continue
        if newest is None or r["run_id"] > newest["run_id"]:
            newest = r
    pages, code, page_dir, built, unavailable = {}, {}, out / "f", 0, 0
    page_dir.mkdir(parents=True, exist_ok=True)
    for r in ([newest] if newest else []):
        # The first rate: the one every target is expected to complete. Picking the middle
        # of the list gave the raised rate once the ladder became two, so a target that
        # could not sustain it had no number on its own page.
        rn = str(r["rungs"][0]) if r.get("rungs") else "1"
        for t in r["targets"]:
            key = "%s:%s" % (t["language"], t["target"])
            view = bundle_at(r, t)
            built += 1
            unavailable += 0 if (view and view["verified"]) else 1
            name = "%s-%s.html" % (t["language"], t["target"])
            (page_dir / name).write_text(
                render_framework(r, t, rn, view, wire, routes, factors))
            pages[key] = "f/" + name
            # The handler for a row is the thing a reader wants when they open that row,
            # so it travels with the numbers rather than living only on the page.
            if view:
                code[key] = snippet_doc(r, view)
    print("wrote %d framework page(s)%s"
          % (built, "" if not unavailable
             else "; %d could not verify their bundle against history" % unavailable))

    (out / "index.html").write_text(render(runs, wire, pages, code))
    # Clear the data directory: a rename or a dropped run would otherwise leave a stale
    # file behind that the manifest no longer references but Pages keeps serving.
    data_dir = out / "data"
    if data_dir.exists():
        for old_file in sorted(data_dir.rglob("*"), reverse=True):
            old_file.unlink() if old_file.is_file() else old_file.rmdir()
    data_dir.mkdir(parents=True, exist_ok=True)
    # Stored gzipped. Pages caps a site at 1 GB and this directory grows by a run a night,
    # so the saving is in bytes at rest rather than on the wire, which Pages already
    # compresses. The client unwraps with DecompressionStream.
    def put(path, obj):
        path.write_bytes(gzip.compress(json.dumps(obj, separators=(",", ":")).encode(), 9))

    for r in runs:
        put(data_dir / ("%s.json.gz" % slug(r["run_id"])), r)
    wire_dir = data_dir / "wire"
    wire_dir.mkdir(exist_ok=True)
    for key, doc in wire.items():
        put(wire_dir / ("%s.json.gz" % key), doc)
    code_dir = data_dir / "code"
    code_dir.mkdir(exist_ok=True)
    for key, doc in code.items():
        put(code_dir / ("%s.json.gz" % key.replace(":", "-")), doc)

    print("read %d summaries (%d tracked)" % (runs.__len__(),
                                              sum(1 for r in runs if r.get("tracked"))))
    embedded = len({(r.get("exec_host") or "container") for r in runs if r.get("tracked")})
    print("wrote %s (%.1f KB): %d run(s) embedded, %d fetched on demand, %d wire captures"
          % (out / "index.html", (out / "index.html").stat().st_size / 1024,
             embedded, len(runs) - embedded, len(wire)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
