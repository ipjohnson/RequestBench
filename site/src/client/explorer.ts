// The explorer: the table, the drill-down and the time axis.
//
// Everything that decides what a row says is in select.ts and lib/; this writes the result
// into the page and wires the controls. The one rule it keeps is that a render is a function
// of the state and nothing else, so the hash reproduces the view exactly.
import { provenance } from "../lib/catalog.js";
import { deltaFor } from "../lib/delta.js";
import { esc } from "../lib/html.js";
import { cell, METRICS, type Unit } from "../lib/metrics.js";
import type { PageData } from "../lib/page-data.js";
import { SERIES_DARK, SERIES_LIGHT } from "../lib/series.js";
import type { Run, Target } from "../lib/types.js";
import { chainTable, deltaCell } from "../lib/views.js";
import { Data, resolveSource, type CodePart } from "./source.js";
import {
  epRowsFor,
  famRowsFor,
  famsAt,
  isSerial,
  pickRung,
  rateLabel,
  rows,
  rungsOf,
  wireKeyFor,
  type Child,
} from "./select.js";
import { COLS, defaultCols, initialState, readHash, writeHash, type Col, type Row, type State } from "./state.js";

const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const series = (): string[] =>
  (matchMedia("(prefers-color-scheme: dark)").matches &&
    document.documentElement.dataset["theme"] !== "light") ||
  document.documentElement.dataset["theme"] === "dark"
    ? SERIES_DARK
    : SERIES_LIGHT;

export async function start(rb: PageData): Promise<void> {
  const source = resolveSource();
  let data: Data;
  try {
    data = await Data.open(rb.boot, source);
  } catch (e) {
    el("meta").textContent =
      `Could not read the results catalog at ${source.base.href}: ` +
      `${e instanceof Error ? e.message : String(e)}`;
    return;
  }
  const { eyebrow, runs } = provenance(data.catalog);
  el("provenance").textContent = eyebrow;
  el("nruns").textContent = String(runs);
  new Explorer(rb, data).start();
}

class Explorer {
  private readonly rb: PageData;
  private readonly data: Data;
  private readonly langs: string[];
  private readonly st: State;
  private shown: Row[] = [];
  private dlgAt: { language: string; target: string; family: string | null; endpoint: string | null } | null = null;
  private ownHash = "";

  constructor(rb: PageData, data: Data) {
    this.rb = rb;
    this.data = data;
    // From the catalog rather than from the runs that happen to be loaded: the chips are a
    // filter and the set they offer should not grow as fetches land.
    this.langs = [...new Set(data.manifest.flatMap((m) => m.languages))].sort();
    this.st = initialState(data.hosts[0] ?? "container", this.langs);
  }

  start(): void {
    this.wire();
    readHash(this.st, location.hash);
    this.render();
    void this.data.fetchHost(this.st.host).then((got) => {
      if (got) this.render();
    });
  }

  /* ---- what is on screen ---- */

  private runsForHost(): Run[] {
    return this.data.loadedRuns(this.st.host);
  }

  private latest(): Run | null {
    const rs = this.runsForHost();
    return rs.length ? (rs[rs.length - 1] ?? null) : null;
  }

  private wireKey(language: string, target: string): string | null {
    const host = this.latest()?.exec_host || "container";
    return wireKeyFor(language, target, host, this.data.catalog.wire);
  }

  private unit(id: string): Unit {
    return id === "value" ? METRICS[this.st.metric].unit : id === "hdrz" || id === "bodyz" ? "B" : "";
  }

  private rows(): { run: Run | null; rn: string | null; rows: Row[] } {
    const run = this.latest();
    const { rn, rows: rs } = rows({
      run,
      st: this.st,
      routes: this.rb.routes,
      wireOf: (language, target) => {
        const k = this.wireKey(language, target);
        return k ? this.data.wireDoc(k) : undefined;
      },
    });
    return { run, rn, rows: rs };
  }

  private forGran = (c: Col): boolean => !c.gran || c.gran === this.st.gran;

  private visibleCols(): Col[] {
    return COLS.filter((c) => (c.pin || this.st.cols.has(c.id)) && this.forGran(c));
  }

  private emptyWhy(run: Run): string {
    if (this.st.gran === "endpoint" && !(run.endpoint_order ?? []).length)
      return "This run predates per-endpoint detail, so it can only be read at blend or family level.";
    return "Nothing matches those filters.";
  }

  /* ---- render ---- */

  render = (): void => {
    const { run, rn, rows: rs } = this.rows();
    const cols = series();
    const langs = this.langs;
    const colour = Object.fromEntries(
      langs.map((l, i) => [l, cols[i % cols.length] ?? cols[0] ?? "#000"]),
    ) as Record<string, string>;

    const hosts = this.data.hosts;
    el("host").innerHTML = hosts
      .map((h) => `<option${h === this.st.host ? " selected" : ""}>${esc(h)}</option>`)
      .join("");
    el("rung").innerHTML = run
      ? rungsOf(run)
          .map(
            (r) =>
              `<option value="${esc(r)}"${r === rn ? " selected" : ""}>${esc(rateLabel(run, r))}</option>`,
          )
          .join("")
      : "";
    el("runglabel").textContent = isSerial(run) ? "Suite" : "Offered rate";
    el<HTMLSelectElement>("metric").value = this.st.metric;
    document
      .querySelectorAll<HTMLButtonElement>(".seg button[data-gran]")
      .forEach((b) => b.setAttribute("aria-pressed", String(b.dataset["gran"] === this.st.gran)));
    el("chips").innerHTML = langs
      .map((l) => {
        const on = this.st.langs.has(l);
        return (
          `<button class="chip" data-lang="${esc(l)}" aria-pressed="${on}"` +
          `${on ? ` style="background:${colour[l]}"` : ""}>` +
          `<i style="background:${on ? "currentColor" : colour[l]}"></i>${esc(l)}</button>`
        );
      })
      .join("");
    el("colchips").innerHTML = COLS.filter((c) => !c.pin && c.label && this.forGran(c))
      .map(
        (c) =>
          `<button class="chip sm" data-col="${esc(c.id)}" aria-pressed="${this.st.cols.has(c.id)}">${esc(c.label)}</button>`,
      )
      .join("");
    el<HTMLInputElement>("q").value = this.st.q;
    for (const id of ["q", "qlabel"])
      el(id).style.display = this.st.gran === "blend" ? "none" : "";

    this.renderHostNote(run, rn);

    if (!run) {
      el("meta").textContent = this.data.missing(this.st.host)
        ? "loading this host…"
        : "no tracked runs for this host yet";
      el("thead").innerHTML = "";
      el("tbody").innerHTML = "";
      el("time").innerHTML = '<p class="empty">No data.</p>';
      this.pushHash();
      return;
    }

    el("meta").textContent =
      `${run.date} · ${run.cpu}, ${run.cores} cores · ${run.exec_host || "container"}` +
      ` · ${isSerial(run) ? "serial" : "rate ladder"} · ${rs.length} rows · click a row for detail`;

    const vc = this.visibleCols();
    const label = (c: Col): string => (c.id === "value" ? METRICS[this.st.metric].label : c.label);
    const sorted = (id: string): string =>
      this.st.sort.col === id ? ` aria-sort="${this.st.sort.dir === 1 ? "ascending" : "descending"}"` : "";
    el("thead").innerHTML =
      `<tr><th style="cursor:default">#</th><th class="l" data-col="name">framework</th>` +
      `<th class="l" data-col="lang">slice</th>` +
      vc
        .map((c) =>
          c.label || c.id === "value"
            ? `<th class="${c.cls === "barcell" ? "barcell" : ""}" data-col="${esc(c.id)}"${sorted(c.id)}>${esc(label(c))}</th>`
            : `<th class="barcell" style="cursor:default"></th>`,
        )
        .join("") +
      `</tr>`;

    const finite = rs.map((r) => r.value).filter((v): v is number => v != null && isFinite(v));
    const worst = finite.length ? Math.max(...finite) : 1;
    el("tbody").innerHTML =
      rs
        .map((r, i) => {
          const w = r.value != null && isFinite(r.value) ? Math.max(1.5, (100 * r.value) / worst) : 0;
          const tds = vc
            .map((c) => {
              if (c.id === "bar")
                return `<td class="barcell"><div class="bar" style="width:${w}%;background:${colour[r.language]}"></div></td>`;
              if (c.id === "delta") return deltaCell(r.delta, METRICS[this.st.metric].unit);
              const extra = c.id === "value" && r.dead ? " dead" : "";
              return `<td class="${c.cls ?? ""}${extra}">${esc(cell(c.get?.(r), this.unit(c.id)))}</td>`;
            })
            .join("");
          return `<tr data-key="${esc(r.key)}" tabindex="0">
      <td class="rank">${i + 1}</td>
      <td class="name l"><span class="swatch" style="background:${colour[r.language]}"></span>${esc(r.label)}</td>
      <td class="sub l">${esc(r.detail || r.language)}</td>${tds}</tr>`;
        })
        .join("") ||
      `<tr><td colspan="${vc.length + 3}" class="empty">${esc(this.emptyWhy(run))}</td></tr>`;
    el("count").textContent = `${rs.length} rows`;

    this.shown = rs;
    this.renderTime(rs);
    this.pushHash();
  };

  /**
   * A host that is a library choice rather than a platform gets an asterisk, and the asterisk
   * carries the measured cost rather than an opinion.
   *
   * p50 against p50, whatever the metric selector says: the ratio is a statement about the
   * host and reads the same number on both sides of it.
   *
   * The Python renderer this replaces read `r.p50`, which no row carries, so the ratio was
   * never computed, and it only reached this at all when the host had no runs, so the note
   * never appeared either. Both are fixed here; gcp-func is the host that has one.
   */
  private renderHostNote(run: Run | null, rn: string | null): void {
    const box = el("hostnote");
    const meta = this.rb.hosts[this.st.host];
    if (!meta) {
      box.style.display = "none";
      return;
    }
    box.style.display = "";
    box.innerHTML = `<strong>${esc(this.st.host)}</strong> &mdash; ${esc(meta.note)}${this.hostCost(run, rn, meta.compare_to)}`;
  }

  private hostCost(run: Run | null, rn: string | null, other: string): string {
    if (!other || !run || !rn) return "";
    const there = this.data.loadedRuns(other);
    if (!there.length) {
      void this.data.fetchHost(other).then((got) => {
        if (got) this.render();
      });
      return "";
    }
    const ref = there[there.length - 1];
    const refRn = ref ? pickRung(ref, this.st.rung) : null;
    if (!ref || !refRn) return "";
    const ratios: number[] = [];
    for (const t of run.targets) {
      if (!this.st.langs.has(t.language)) continue;
      const here = t.rungs[rn]?.p50_us;
      const away = ref.targets.find((x) => x.language === t.language && x.target === t.target)
        ?.rungs[refRn]?.p50_us;
      if (here && away) ratios.push(here / away);
    }
    if (!ratios.length) return "";
    const lo = Math.min(...ratios);
    const hi = Math.max(...ratios);
    return (
      ` Measured against <strong>${esc(other)}</strong> on the same targets, this host costs ` +
      (hi < 1.05
        ? `nothing measurable (${lo.toFixed(2)}\u2013${hi.toFixed(2)}x).`
        : `${lo.toFixed(2)}\u2013${hi.toFixed(2)}x.`)
    );
  }

  /* ---- the drill-down ---- */

  /**
   * A framework page is per target, but a row's key carries its slice: node:fastify at blend
   * granularity, node:fastify|domain at family. Look the page up by the target itself, or the
   * link appears on one of the three views and not the other two.
   */
  private pageFor(language: string, target: string): string | undefined {
    return this.rb.pages[`${language}:${target}`];
  }

  private childTable(caption: string, kids: Child[], level: "family" | "endpoint"): string {
    if (!kids.length) return `<p class="empty">Nothing at this level for this target.</p>`;
    const withRoute = level === "endpoint";
    const unit = METRICS[this.st.metric].unit;
    // Cut the route here rather than in CSS: the table is auto-layout, so a max-width on a
    // cell is advisory and query.many's eight parameters would widen the whole dialog.
    const clip = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
    const routeCell = (id: string): string => {
      if (!withRoute) return "";
      const r = this.rb.routes[id];
      if (!r) return '<td class="l route">&mdash;</td>';
      return (
        `<td class="l route" title="${esc(`${r.m} ${r.p}`)}">` +
        `<span class="verb">${esc(r.m)}</span> ${esc(clip(r.p, 44))}</td>`
      );
    };
    const body = kids
      .map(
        (k) => `
    <tr data-down="${esc(level)}" data-id="${esc(k.id)}">
      <td class="l name">${esc(k.id)}</td>${routeCell(k.id)}
      ${withRoute ? "" : `<td class="sub">${k.eps ?? 0}</td>`}
      <td>${esc(cell(k.value, unit))}</td>
      ${withRoute ? deltaCell(k.delta, unit) : ""}
      <td class="sub">${k.n == null ? "&mdash;" : Math.round(k.n).toLocaleString()}</td>
      <td class="sub go">open &rarr;</td>
    </tr>`,
      )
      .join("");
    return `<h3 class="childcap">${esc(caption)}</h3>
    <div class="scroll childscroll"><table><thead><tr>
      <th class="l">${withRoute ? "endpoint" : "family"}</th>
      ${withRoute ? '<th class="l">route</th>' : "<th>endpoints</th>"}
      <th>${esc(METRICS[this.st.metric].label)}</th>
      ${withRoute ? "<th title=\"Against the root of this endpoint's base chain\">over base</th>" : ""}
      <th>samples</th><th></th>
    </tr></thead><tbody>${body}</tbody></table></div>`;
  }

  private crumbs(t: Target): string {
    const at = this.dlgAt;
    if (!at) return "";
    const parts = [`<button data-up="blend">${esc(t.target)}</button>`];
    if (at.family) parts.push(`<button data-up="family">${esc(at.family)}</button>`);
    if (at.endpoint) parts.push(`<span>${esc(at.endpoint)}</span>`);
    return `<nav class="crumbs">${parts.join("<i>›</i>")}</nav>`;
  }

  private async openDetail(key: string): Promise<void> {
    const r = this.shown.find((x) => x.key === key);
    if (!r) return;
    this.dlgAt = {
      language: r.language,
      target: r.target,
      family: this.st.gran === "family" ? r.detail : this.st.gran === "endpoint" ? (r.family ?? null) : null,
      endpoint: this.st.gran === "endpoint" ? r.detail : null,
    };
    await this.paintDetail();
    el<HTMLDialogElement>("dlg").showModal();
  }

  private async paintDetail(): Promise<void> {
    const run = this.latest();
    const at = this.dlgAt;
    if (!run || !at) return;
    const t = run.targets.find((x) => x.language === at.language && x.target === at.target);
    if (!t) return;
    const rn = pickRung(run, this.st.rung);
    if (!rn) return;
    const tkey = `${at.language}:${at.target}`;
    const box = el("dlgbody");
    const page = this.pageFor(at.language, at.target);
    const unit = METRICS[this.st.metric].unit;
    const head = `
    <div class="wirehead"><strong>${esc(t.framework || t.target)}</strong>
      <span class="ver">${esc(t.version ?? "")}</span>
      <span class="wmeta">${esc(t.language)}</span>
      ${page ? `<a class="fwlink" href="${esc(page)}">README &amp; bundle &rarr;</a>` : ""}</div>
    ${this.crumbs(t)}`;

    if (!at.endpoint) {
      const kids = at.family
        ? epRowsFor(run, t, rn, at.family, this.st.metric, this.rb.routes)
        : famRowsFor(run, t, rn, this.st.metric, this.rb.routes);
      const self: Record<string, unknown> = at.family
        ? (famsAt(t, rn)[at.family] ?? {})
        : (t.rungs[rn] ?? {});
      const value = (self[this.st.metric] ?? self["p50_us"]) as number | null | undefined;
      const n = (self["count"] ?? self["achieved_rps"]) as number | null | undefined;
      box.innerHTML =
        head +
        `
      <div class="fields">
        <div class="frow"><span class="fk">${esc(METRICS[this.st.metric].label)}</span><span class="fv">${esc(cell(value, unit))}</span></div>
        <div class="frow"><span class="fk">samples</span><span class="fv">${esc(cell(n))}</span></div>
      </div>` +
        this.childTable(
          at.family ? `Endpoints in ${at.family}` : "Families",
          kids,
          at.family ? "endpoint" : "family",
        );
      return;
    }

    /* the leaf: this endpoint's handler, then what it actually put on the wire */
    const eid = at.endpoint;
    const d = t.endpoints?.[eid]?.rungs?.[rn] ?? {};
    const stat = (lab: string, k: string, u: Unit): string =>
      `<div class="frow"><span class="fk">${esc(lab)}</span><span class="fv">${esc(cell((d as Record<string, number | null | undefined>)[k], u))}</span></div>`;
    const route = this.rb.routes[eid];
    box.innerHTML =
      head +
      `
    ${route ? `<p class="leafroute"><span class="verb">${esc(route.m)}</span> ${esc(route.p)}</p>` : ""}
    <div class="fields">
      ${stat("p50", "p50_us", "us")}${stat("p90", "p90_us", "us")}
      ${stat("p99", "p99_us", "us")}${stat("p99.9", "p999_us", "us")}
      ${stat("samples", "count", "")}
    </div>
    ${chainTable(deltaFor(t, eid, rn, this.rb.routes, this.st.metric), this.rb.factors, METRICS[this.st.metric].label, unit)}
    <p class="empty" id="leafload">Loading the handler and the captured exchange…</p>`;

    const wireKey = this.wireKey(at.language, at.target);
    const [codeDoc, wdoc] = await Promise.all([
      this.data.fetchCode(tkey),
      wireKey ? this.data.fetchWire(wireKey) : Promise.resolve(null),
    ]);
    // The dialog may have been drilled elsewhere while those were in flight.
    if (this.dlgAt !== at || at.endpoint !== eid) return;

    const sn = codeDoc?.[eid];
    const e = wdoc?.endpoints[eid];
    const block = (p: CodePart): string =>
      `<div class="sniphead"><span class="loc">${esc(`${p.f}:${p.s}${p.e === p.s ? "" : `-${p.e}`}`)}</span><span class="how">${esc(p.h)}</span>
      ${p.u ? `<a href="${esc(p.u)}">open on GitHub &rarr;</a>` : `<span class="how">commit not on a remote, so no link</span>`}</div>
    <pre class="code">${esc(p.t)}</pre>`;
    const handler = sn
      ? `
    <h3 class="childcap">Handler</h3>
    ${block(sn)}`
      : `<p class="empty">No handler located for this endpoint in this target.</p>`;
    // The code the route does not name: what the family is wired with, and the parts that
    // do it. A family with nothing to show says so, because a blank section reads as
    // missing data rather than as a framework that needed no wiring.
    const declared = sn?.w?.m
      ? `<p class="mech">${esc(sn.w.m)}${sn.w.d ? ` &middot; <code>${esc(sn.w.d)}</code>` : ""}</p>`
      : sn?.w?.b
        ? `<p class="mech">${esc(sn.w.b)}</p>`
        : "";
    const wiring =
      declared || sn?.sup?.length
        ? `
    <h3 class="childcap">Wiring</h3>
    <div class="wiring">${declared}${(sn?.sup ?? []).map(block).join("")}</div>`
        : "";
    const hdr = (hs: readonly (readonly [string, string])[]): string =>
      hs
        .map(
          ([k, v]) =>
            `<div class="hrow"><span class="hk">${esc(k)}</span><span class="hv">${esc(v)}</span></div>`,
        )
        .join("");
    const exchange = e
      ? `
    <h3 class="childcap">On the wire</h3>
    <div class="wirecols">
      <div><h3>Request</h3>
        <pre class="wire req">${esc(e.m)} ${esc(e.p)}</pre>
        <div class="hdrs">${hdr(e.rh)}</div>
        ${e.rb ? `<pre class="wire">${esc(e.rb)}${e.rbz > 700 ? `\n… ${e.rbz.toLocaleString()} bytes total` : ""}</pre>` : '<p class="empty" style="padding:6px 0">no body</p>'}
      </div>
      <div><h3>Response</h3>
        <pre class="wire res">HTTP ${e.s}</pre>
        <div class="hdrs">${hdr(e.sh)}</div>
        ${e.sb ? `<pre class="wire">${esc(e.sb)}${e.tr ? `\n… ${e.sbz.toLocaleString()} bytes total` : ""}</pre>` : '<p class="empty" style="padding:6px 0">no body</p>'}
      </div>
    </div>`
      : "";
    const load = document.getElementById("leafload");
    const tests = sn?.tst?.length
      ? `
    <h3 class="childcap">Contract test</h3>
    <div class="wiring">${sn.tst.map(block).join("")}</div>`
      : "";
    if (load) load.outerHTML = handler + wiring + tests + exchange;
  }

  /* ---- the time axis ---- */

  private renderTime(rs: Row[]): void {
    const box = el("time");
    // The history needs every run on this host, not just the embedded newest one.
    if (this.data.missing(this.st.host)) {
      box.innerHTML = '<p class="empty">Loading history…</p>';
      void this.data.fetchHost(this.st.host).then((got) => {
        if (got) this.render();
      });
      return;
    }
    const runs = this.runsForHost();
    if (runs.length < 2) {
      box.innerHTML =
        '<p class="empty">One run on this host so far. The time axis fills in as runs accumulate.</p>';
      return;
    }
    const keys = rs.slice(0, 6).map((r) => r.key);
    const cols = series();
    const series_ = new Map<string, { date: string; v: number; ver: string; adapter: string }[]>();
    for (const run of runs) {
      const rn = (this.st.rung && rungsOf(run).includes(this.st.rung) ? this.st.rung : pickRung(run, null)) ?? "";
      for (const t of run.targets) {
        const base = `${t.language}:${t.target}`;
        for (const k of keys) {
          const [kb, det] = k.split("|");
          if (kb !== base) continue;
          const at = !det
            ? t.rungs[rn]
            : t.endpoints?.[det]
              ? t.endpoints[det]?.rungs?.[rn]
              : famsAt(t, rn)[det];
          const raw = at?.[this.st.metric];
          const v = typeof raw === "number" ? raw : null;
          if (v == null) continue;
          if (!series_.has(k)) series_.set(k, []);
          series_.get(k)?.push({ date: run.date ?? "", v, ver: t.version ?? "", adapter: t.adapter ?? "" });
        }
      }
    }
    const live = [...series_.entries()].filter(([, pts]) => pts.length);
    if (!live.length || !live.some(([, pts]) => pts.length > 1)) {
      box.innerHTML = '<p class="empty">Not enough runs yet for these rows.</p>';
      return;
    }

    const W = 940, H = 260, P = 78, R = 52;
    const all = live.flatMap(([, pts]) => pts.map((x) => x.v));
    const lo = Math.min(...all) * 0.92;
    const hi = Math.max(...all) * 1.08;
    const n = Math.max(...live.map(([, pts]) => pts.length));
    const X = (i: number): number => P + (W - P - R) * (n < 2 ? 0.5 : i / (n - 1));
    const Y = (v: number): number => H - 44 - (H - 62) * ((v - lo) / (hi - lo || 1));
    const unit = METRICS[this.st.metric].unit;

    let g = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(METRICS[this.st.metric].label)} over time">`;
    for (let k = 0; k <= 4; k++) {
      const v = lo + ((hi - lo) * k) / 4;
      g += `<line x1="${P}" y1="${Y(v).toFixed(1)}" x2="${W - R}" y2="${Y(v).toFixed(1)}" stroke="var(--rule)" stroke-width="1"/>`;
      g += `<text x="${P - 7}" y="${(Y(v) + 3).toFixed(1)}" fill="var(--ink3)" font-size="10" font-family="var(--f-mono)" text-anchor="end">${esc(cell(v, unit).replace(" us", ""))}</text>`;
    }
    live.forEach(([, pts], idx) => {
      const c = cols[idx % cols.length] ?? cols[0] ?? "#000";
      g += `<path d="${pts.map((pt, i) => `${i ? "L" : "M"} ${X(i).toFixed(1)} ${Y(pt.v).toFixed(1)}`).join(" ")}" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round"/>`;
      let prev: string | null = null;
      let prevAd: string | null = null;
      pts.forEach((pt, i) => {
        const newVer = prev !== null && Boolean(pt.ver) && pt.ver !== prev;
        const newAd = prevAd !== null && pt.adapter !== prevAd;
        const changed = newVer || newAd;
        const label = newVer ? pt.ver : `via ${pt.adapter.split(" ").pop() ?? ""}`;
        prev = pt.ver || prev;
        prevAd = pt.adapter;
        const anchor = i === 0 ? "start" : i >= n - 1 ? "end" : "middle";
        g += changed
          ? `<circle cx="${X(i).toFixed(1)}" cy="${Y(pt.v).toFixed(1)}" r="5.5" fill="var(--surface)" stroke="${c}" stroke-width="2"/><text x="${X(i).toFixed(1)}" y="${(Y(pt.v) - 11).toFixed(1)}" fill="${c}" font-size="9" font-family="var(--f-mono)" text-anchor="${anchor}">${esc(label)}</text>`
          : `<circle cx="${X(i).toFixed(1)}" cy="${Y(pt.v).toFixed(1)}" r="3.2" fill="${c}"/>`;
      });
    });
    const step = Math.max(1, Math.ceil(n / 8));
    runs.slice(0, n).forEach((run, i) => {
      if (i % step && i !== n - 1) return;
      const anchor = i === 0 ? "start" : i === n - 1 ? "end" : "middle";
      g += `<text x="${X(i).toFixed(1)}" y="${H - 16}" fill="var(--ink3)" font-size="10" font-family="var(--f-mono)" text-anchor="${anchor}">${esc((run.date ?? "").slice(5))}</text>`;
    });
    g += "</svg>";
    const legend = live
      .map(
        ([k], i) =>
          `<span><b style="background:${cols[i % cols.length]}"></b>${esc(k.replace("|", " · "))}</span>`,
      )
      .join("");
    box.innerHTML = `${g}<div class="legend">${legend}<span style="color:var(--ink3)">hollow ring = new framework or adapter version</span></div>`;
  }

  /* ---- wiring ---- */

  private pushHash(): void {
    const h = writeHash(this.st, this.langs);
    history.replaceState(null, "", h);
    this.ownHash = location.hash;
  }

  private wire(): void {
    el<HTMLSelectElement>("host").onchange = async (e): Promise<void> => {
      this.st.host = (e.target as HTMLSelectElement).value;
      this.st.rung = null;
      this.render();
      if (await this.data.fetchHost(this.st.host)) this.render();
    };
    el<HTMLSelectElement>("rung").onchange = (e): void => {
      this.st.rung = (e.target as HTMLSelectElement).value;
      this.render();
    };
    el<HTMLSelectElement>("metric").onchange = (e): void => {
      const v = (e.target as HTMLSelectElement).value;
      if (v in METRICS) this.st.metric = v as State["metric"];
      this.render();
    };
    el<HTMLInputElement>("q").oninput = (e): void => {
      this.st.q = (e.target as HTMLInputElement).value;
      this.render();
    };
    document.querySelectorAll<HTMLButtonElement>(".seg button[data-gran]").forEach((b) => {
      b.onclick = (): void => {
        const g = b.dataset["gran"];
        if (g === "blend" || g === "family" || g === "endpoint") this.st.gran = g;
        this.render();
      };
    });
    el("chips").onclick = (e): void => {
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-lang]");
      const l = b?.dataset["lang"];
      if (!l) return;
      if (this.st.langs.has(l)) this.st.langs.delete(l);
      else this.st.langs.add(l);
      if (!this.st.langs.size) this.st.langs = new Set(this.langs);
      this.render();
    };
    el("colchips").onclick = (e): void => {
      const c = (e.target as HTMLElement).closest<HTMLElement>("[data-col]")?.dataset["col"];
      if (!c) return;
      if (this.st.cols.has(c)) this.st.cols.delete(c);
      else this.st.cols.add(c);
      this.render();
    };
    el("thead").onclick = (e): void => {
      const c = (e.target as HTMLElement).closest<HTMLElement>("th[data-col]")?.dataset["col"];
      if (!c) return;
      this.st.sort = { col: c, dir: this.st.sort.col === c ? -this.st.sort.dir : 1 };
      this.render();
    };
    el("tbody").onclick = (e): void => {
      const key = (e.target as HTMLElement).closest<HTMLElement>("tr[data-key]")?.dataset["key"];
      if (key) void this.openDetail(key);
    };
    el("tbody").onkeydown = (e): void => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const key = (e.target as HTMLElement).closest<HTMLElement>("tr[data-key]")?.dataset["key"];
      if (key) {
        e.preventDefault();
        void this.openDetail(key);
      }
    };
    el("dlgclose").onclick = (): void => el<HTMLDialogElement>("dlg").close();
    /* Drilling happens inside the dialog, so one delegated handler covers both directions. */
    el("dlgbody").onclick = (e): void => {
      const at = this.dlgAt;
      if (!at) return;
      const down = (e.target as HTMLElement).closest<HTMLElement>("tr[data-down]");
      if (down) {
        const id = down.dataset["id"] ?? "";
        if (down.dataset["down"] === "family") at.family = id;
        else at.endpoint = id;
        void this.paintDetail();
        el("dlgbody").scrollTop = 0;
        return;
      }
      const up = (e.target as HTMLElement).closest<HTMLElement>("button[data-up]");
      if (up) {
        if (up.dataset["up"] === "blend") {
          at.family = null;
          at.endpoint = null;
        } else at.endpoint = null;
        void this.paintDetail();
      }
    };
    el("dlg").onclick = (e): void => {
      if ((e.target as HTMLElement).id === "dlg") el<HTMLDialogElement>("dlg").close();
    };
    el("reset").onclick = (): void => {
      this.st.langs = new Set(this.langs);
      this.st.q = "";
      this.st.rung = null;
      this.st.cols = defaultCols();
      this.st.sort = { col: "value", dir: 1 };
      this.render();
    };
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", this.render);
    addEventListener("hashchange", () => {
      if (location.hash === this.ownHash) return;
      readHash(this.st, location.hash);
      this.render();
      // Pull the rest of this host's runs in the background so the history fills in.
      void this.data.fetchHost(this.st.host).then((got) => {
        if (got) this.render();
      });
    });
  }
}
