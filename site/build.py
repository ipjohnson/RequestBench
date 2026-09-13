"""Render the results site from committed summaries.

Reads every summary JSON, keeps the newest tracked run per shard as the headline, and
emits one self-contained page. No build step, no fetch: the data is embedded, so the
output works from a file:// URL and from Pages identically.

  python3 site/build.py --summaries results/summary --out site/dist
"""
import argparse, html, json, pathlib, sys, datetime as dt
from collections import defaultdict

T = {  # light, dark
    "ground": ("#F4F5F2", "#121513"), "surface": ("#FCFCFB", "#1A1E1B"),
    "surface2": ("#EDEFEA", "#232823"), "ink": ("#121917", "#E8ECE7"),
    "ink2": ("#58655F", "#9AA59E"), "ink3": ("#66716A", "#949E98"),
    "rule": ("#DCE0DB", "#2A302C"), "rule2": ("#C3C9C2", "#3A423C"),
    "teal": ("#00836E", "#35AD97"), "tealtext": ("#00705E", "#35AD97"),
    "amber": ("#A6670C", "#DDA03C"), "tealsoft": ("#DCEBE6", "#17302B"),
    "onfill": ("#FFFFFF", "#101614"),
}

def tokens(i):
    return "\n".join("  --%s: %s;" % (k, v[i]) for k, v in T.items())

CSS = """
:root {
%s
  --f-display: "Newsreader", Georgia, serif;
  --f-body: "Archivo", "Helvetica Neue", Arial, sans-serif;
  --f-mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
%s
} }
:root[data-theme="dark"] {
%s
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--ground); color: var(--ink);
       font-family: var(--f-body); font-size: 16px; line-height: 1.6;
       -webkit-font-smoothing: antialiased; }
.page { max-width: 1080px; margin: 0 auto; padding-inline: clamp(18px, 5vw, 48px);
        padding-block: clamp(36px, 6vw, 72px) 56px; }
a { color: var(--tealtext); text-underline-offset: 3px; }
code, .mono { font-family: var(--f-mono); }
.eyebrow { font-family: var(--f-mono); font-size: 11px; letter-spacing: .13em;
           text-transform: uppercase; color: var(--tealtext); margin: 0 0 16px;
           display: flex; gap: 12px; align-items: center; }
.eyebrow::after { content:""; flex:1; height:1px; background: var(--rule2); }
h1 { font-family: var(--f-display); font-weight: 600; letter-spacing: -.02em;
     font-size: clamp(34px, 5.5vw, 52px); line-height: 1.05; margin: 0 0 18px; }
.lede { font-family: var(--f-display); font-size: clamp(17px, 2.2vw, 20px);
        color: var(--ink2); max-width: 62ch; margin: 0; }
.meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px,1fr));
        gap: 1px; background: var(--rule); border: 1px solid var(--rule);
        border-radius: 3px; overflow: hidden; margin: 36px 0 0; }
.meta div { background: var(--surface); padding: 14px 16px 16px; }
.meta dt { font-family: var(--f-mono); font-size: 10px; letter-spacing: .1em;
           text-transform: uppercase; color: var(--ink3); margin: 0 0 6px; }
.meta dd { margin: 0; font-family: var(--f-display); font-size: 23px; line-height: 1;
           font-variant-numeric: tabular-nums; }
.meta dd span { font-family: var(--f-body); font-size: 12px; color: var(--ink2); }
section { margin-top: clamp(48px, 7vw, 72px); }
.shead { border-top: 1px solid var(--rule2); padding-top: 14px; margin-bottom: 8px;
         display: flex; justify-content: space-between; align-items: baseline;
         gap: 16px; flex-wrap: wrap; }
h2 { font-family: var(--f-display); font-weight: 600; font-size: clamp(23px, 3vw, 30px);
     margin: 0; letter-spacing: -.015em; }
.sub { font-size: 13px; color: var(--ink2); margin: 0 0 22px; }
.scroll { overflow-x: auto; }
table { border-collapse: collapse; width: 100%%; min-width: 560px; font-size: 14px; }
th, td { text-align: right; padding: 10px 12px; border-bottom: 1px solid var(--rule);
         font-variant-numeric: tabular-nums; }
th:first-child, td:first-child { text-align: left; }
thead th { font-family: var(--f-mono); font-size: 10px; letter-spacing: .09em;
           text-transform: uppercase; color: var(--ink3); font-weight: 500;
           border-bottom: 1px solid var(--rule2); }
tbody tr:last-child td { border-bottom: none; }
td.name { font-weight: 600; white-space: nowrap; }
tr.baseline td { color: var(--ink2); }
tr.baseline td.name { color: var(--ink); }
.ver { font-family: var(--f-mono); font-size: 12px; color: var(--ink2); }
.pill { display: inline-block; font-family: var(--f-mono); font-size: 11px;
        padding: 2px 7px; border-radius: 2px; background: var(--tealsoft);
        color: var(--tealtext); white-space: nowrap; }
.ratio { font-family: var(--f-mono); }
.ratio.up { color: var(--amber); }
.chart { background: var(--surface); border: 1px solid var(--rule); border-radius: 3px;
         padding: 18px; margin-top: 18px; }
.legend { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 14px;
          font-size: 12px; color: var(--ink2); }
.legend span { display: flex; align-items: center; gap: 6px; }
.legend b { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
.note { border-left: 2px solid var(--amber); background: var(--surface);
        padding: 14px 18px; border-radius: 0 3px 3px 0; margin-top: 24px;
        font-size: 14px; color: var(--ink2); }
footer { margin-top: 64px; border-top: 1px solid var(--rule2); padding-top: 18px;
         font-family: var(--f-mono); font-size: 11px; letter-spacing: .04em;
         color: var(--ink3); display: flex; justify-content: space-between;
         gap: 16px; flex-wrap: wrap; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
:focus-visible { outline: 2px solid var(--teal); outline-offset: 2px; }
""" % (tokens(0), tokens(1), tokens(1))

SERIES = ["#00836E", "#A6670C", "#4668A8", "#A1527F", "#5C7A33", "#8A4B2A"]

def esc(s):
    return html.escape(str(s))

def load(d):
    runs = []
    for f in sorted(pathlib.Path(d).glob("*.json")):
        if f.name.startswith("."):
            continue
        try:
            runs.append(json.loads(f.read_text()))
        except json.JSONDecodeError:
            print("  skipping unreadable %s" % f, file=sys.stderr)
    return runs

def latest_per_shard(runs):
    best = {}
    for r in runs:
        if not r.get("tracked"):
            continue
        cur = best.get(r["shard"])
        if cur is None or r["run_id"] > cur["run_id"]:
            best[r["shard"]] = r
    return dict(sorted(best.items()))

def ratio_cell(v):
    if v is None:
        return '<td class="ratio">&mdash;</td>'
    cls = "ratio up" if v > 1.15 else "ratio"
    return '<td class="%s">%.2fx</td>' % (cls, v)

def shard_table(run):
    rungs = run["rungs"]
    head = "".join("<th>%s rps</th><th>ratio</th>" % f"{next((t['rungs'][str(rn)]['offered_rps'] for t in run['targets'] if str(rn) in t['rungs']), rn):,}"
                   for rn in rungs)
    rows = []
    for t in run["targets"]:
        is_base = t["target"] == run["baseline"]
        cells = []
        for rn in rungs:
            d = t["rungs"].get(str(rn))
            if not d:
                cells.append("<td>&mdash;</td><td>&mdash;</td>")
                continue
            cells.append("<td>%d us</td>%s" % (d["p50_us"], ratio_cell(d["p50_ratio"])))
        label = esc(t["target"]) + (' <span class="pill">baseline</span>' if is_base else "")
        ver = '<td class="ver">%s</td>' % (esc(t.get("version") or "\u2014"))
        rows.append('<tr class="%s"><td class="name">%s</td>%s%s</tr>'
                    % ("baseline" if is_base else "", label, ver, "".join(cells)))
    return ('<div class="scroll"><table><thead><tr><th>target</th><th>version</th>%s</tr>'
            "</thead><tbody>%s</tbody></table></div>" % (head, "".join(rows)))

def family_table(run):
    fams = sorted({f for t in run["targets"] for f in t["families"]})
    if not fams:
        return ""
    others = [t for t in run["targets"] if t["target"] != run["baseline"]]
    head = "".join("<th>%s</th>" % esc(t["target"]) for t in others)
    rows = []
    for f in fams:
        base = next((t["families"].get(f, {}).get("p50_us")
                     for t in run["targets"] if t["target"] == run["baseline"]), None)
        cells = "".join(ratio_cell(t["families"].get(f, {}).get("p50_ratio")) for t in others)
        rows.append("<tr><td class=\"name\">%s</td><td>%s us</td>%s</tr>"
                    % (esc(f), base if base else "&mdash;", cells))
    return ('<div class="scroll"><table><thead><tr><th>family</th>'
            "<th>%s</th>%s</tr></thead><tbody>%s</tbody></table></div>"
            % (esc(run["baseline"]), head, "".join(rows)))

def history_chart(runs, shard, rung):
    pts = defaultdict(list)
    for r in sorted((x for x in runs if x["tracked"] and x["shard"] == shard),
                    key=lambda x: x["run_id"]):
        for t in r["targets"]:
            if t["target"] == r["baseline"]:
                continue
            d = t["rungs"].get(str(rung))
            if d and d["p50_ratio"]:
                pts[t["target"]].append((r["run_id"][:10], d["p50_ratio"],
                                         t.get("version", "")))
    if not any(len(v) > 1 for v in pts.values()):
        n = max((len(v) for v in pts.values()), default=0)
        return ('<div class="note">Ratio history needs more than one tracked run. '
                "There %s so far.</div>"
                % ("is 1" if n == 1 else "are %d" % n))
    W, H, PAD = 900, 220, 38
    allv = [v for s in pts.values() for _, v, _ in s]
    lo, hi = min(1.0, min(allv)) * 0.95, max(allv) * 1.08
    n = max(len(v) for v in pts.values())
    x = lambda i: PAD + (W - 2 * PAD) * (i / max(1, n - 1))
    y = lambda v: H - PAD - (H - 2 * PAD) * ((v - lo) / (hi - lo))
    parts = ['<svg viewBox="0 0 %d %d" width="100%%" role="img" '
             'aria-label="p50 ratio to baseline over time">' % (W, H)]
    for g in range(5):
        v = lo + (hi - lo) * g / 4
        parts.append('<line x1="%d" y1="%.1f" x2="%d" y2="%.1f" stroke="var(--rule)" '
                     'stroke-width="1"/>' % (PAD, y(v), W - PAD, y(v)))
        parts.append('<text x="%d" y="%.1f" fill="var(--ink3)" font-size="10" '
                     'font-family="var(--f-mono)" text-anchor="end">%.2fx</text>'
                     % (PAD - 6, y(v) + 3, v))
    for i, (name, series) in enumerate(sorted(pts.items())):
        col = SERIES[i % len(SERIES)]
        d = " ".join("%s %.1f %.1f" % ("M" if j == 0 else "L", x(j), y(v))
                     for j, (_, v, _) in enumerate(series))
        parts.append('<path d="%s" fill="none" stroke="%s" stroke-width="2" '
                     'stroke-linejoin="round"/>' % (d, col))
        prev = None
        for j, (_, v, ver) in enumerate(series):
            # A hollow ring marks the first run on a new framework version, so a step in
            # the line can be told apart from runner-to-runner noise.
            changed = prev is not None and ver and ver != prev
            prev = ver or prev
            if changed:
                parts.append('<circle cx="%.1f" cy="%.1f" r="5.5" fill="var(--surface)" '
                             'stroke="%s" stroke-width="2"/>' % (x(j), y(v), col))
                parts.append('<text x="%.1f" y="%.1f" fill="%s" font-size="9" '
                             'font-family="var(--f-mono)" text-anchor="middle">%s</text>'
                             % (x(j), y(v) - 11, col, esc(ver)))
            else:
                parts.append('<circle cx="%.1f" cy="%.1f" r="3.5" fill="%s"/>'
                             % (x(j), y(v), col))
    labels = sorted({d for s in pts.values() for d, _, _ in s})
    for j, lab in enumerate(labels[:n]):
        parts.append('<text x="%.1f" y="%d" fill="var(--ink3)" font-size="10" '
                     'font-family="var(--f-mono)" text-anchor="middle">%s</text>'
                     % (x(j), H - 12, esc(lab)))
    parts.append("</svg>")
    legend = "".join('<span><b style="background:%s"></b>%s <span class="ver">%s</span></span>'
                     % (SERIES[i % len(SERIES)], esc(k), esc(pts[k][-1][2] or ""))
                     for i, k in enumerate(sorted(pts)))
    return ('<div class="chart">%s<div class="legend">%s'
            '<span style="color:var(--ink3)">hollow ring = first run on a new version</span>'
            "</div></div>" % ("".join(parts), legend))

def render(runs):
    latest = latest_per_shard(runs)
    tracked = [r for r in runs if r.get("tracked")]
    now = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    body = []
    if not latest:
        body.append('<div class="note">No tracked runs yet. A shortened ladder is a '
                    "smoke test and never enters the series, so the first full run on the "
                    "schedule will populate this page.</div>")
    for shard, run in latest.items():
        mid = run["rungs"][len(run["rungs"]) // 2]
        body.append(
            "<section>"
            '<div class="shead"><h2>%s</h2><span class="pill">%s</span></div>'
            '<p class="sub">%s &middot; %s, %d cores &middot; baseline <code>%s</code> '
            "&middot; p50 and its ratio to that baseline, lower is better.</p>"
            "%s<h3 style=\"font-size:13px;text-transform:uppercase;letter-spacing:.07em;"
            "color:var(--ink2);margin:28px 0 10px\">By endpoint family at %s rps</h3>%s"
            "%s</section>"
            % (esc(shard), esc(run["run_id"][:16]), esc(run["date"]), esc(run["cpu"]),
               run["cores"], esc(run["baseline"]), shard_table(run),
               f"{next((t['rungs'][str(mid)]['offered_rps'] for t in run['targets'] if str(mid) in t['rungs']), mid):,}",
               family_table(run), history_chart(runs, shard, mid)))
    return """<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RequestBench Results</title>
<meta name="description" content="Framework overhead over a bare baseline, measured per language.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:wght@400;600&family=Archivo:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>%s</style></head><body><div class="page">
<p class="eyebrow">blend-v1 &middot; epoch 1 &middot; built %s</p>
<h1>RequestBench Results</h1>
<p class="lede">What a web framework costs you over writing the same forty endpoints
with no framework at all, in the same language, on the same machine, in the same minute.</p>
<dl class="meta">
<div><dt>Shards</dt><dd>%d</dd></div>
<div><dt>Tracked runs</dt><dd>%d</dd></div>
<div><dt>Endpoints</dt><dd>40</dd></div>
<div><dt>Rungs</dt><dd>5 <span>500&ndash;12k rps</span></dd></div>
</dl>
%s
<div class="note">Runs happen on GitHub-hosted runners, whose hardware varies between
runs, so no absolute number here is comparable night to night. Each shard measures its
own bare baseline in the same job on the same machine, and only the ratio to it is
meant to be read across runs. Comparing one language to another is not supported by
this design.</div>
<footer><span>github.com/ipjohnson/RequestBench</span><span>raw histograms in the run artifacts, 90 days</span></footer>
</div></body></html>""" % (CSS, esc(now), len(latest), len(tracked), "".join(body))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--summaries", default="results/summary")
    ap.add_argument("--out", default="site/dist")
    a = ap.parse_args()
    runs = load(a.summaries)
    out = pathlib.Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "index.html").write_text(render(runs))
    (out / "data.json").write_text(json.dumps(runs, indent=1, sort_keys=True))
    print("read %d summaries (%d tracked) from %s"
          % (len(runs), sum(1 for r in runs if r.get("tracked")), a.summaries))
    print("wrote %s (%.1f KB) and data.json (%.1f KB)"
          % (out / "index.html", (out / "index.html").stat().st_size / 1024,
             (out / "data.json").stat().st_size / 1024))
    return 0

if __name__ == "__main__":
    sys.exit(main())
