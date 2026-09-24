// The explorer: the table and the time axis. A row opens its framework page.
//
// Everything that decides what a row says is in select.ts and lib/; this writes the result
// into the page and wires the controls. The one rule it keeps is that a render is a function
// of the state and nothing else, so the hash reproduces the view exactly.
import { blendNamed, entriesOf, isBlend, labelOf, sharesOf, testsOfPick, weightsOf, type BlendId } from "../lib/blends.ts";
import { provenance } from "../lib/catalog.ts";
import { esc } from "../lib/html.ts";
import { cell, METRICS, type Unit } from "../lib/metrics.ts";
import type { PageData } from "../lib/page-data.ts";
import { DEFAULT_HOST, familyOf, famsAt, hostOf, machineOf, machinesFor, metaOf, rungsOf, testOrder, timeline } from "../lib/run.ts";
import { SERIES_DARK, SERIES_LIGHT } from "../lib/series.ts";
import type { Run } from "../lib/types.ts";
import { deltaCell } from "../lib/views.ts";
import { Data, resolveSource } from "./source.ts";
import { blendValue, choicesAt, filterFor, pickRung, rateLabel, rows, wireKeyFor } from "./select.ts";
import { blendIn, COLS, defaultCols, initialState, pageHref, readHash, writeHash, type Col, type Row, type State } from "./state.ts";

const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const series = (): string[] =>
  (matchMedia("(prefers-color-scheme: dark)").matches && document.documentElement.dataset["theme"] !== "light") ||
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
      `Could not read the results catalog at ${source.base.href}: ` + `${e instanceof Error ? e.message : String(e)}`;
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
  /** Wire captures already asked for, so a render while one is in flight does not ask again. */
  private readonly wireAsked = new Set<string>();
  private ownHash = "";
  /** The filter's suggestions as last written. */
  private qopts = "";
  /** The custom picker as last written, so a render that changes nothing in it leaves it alone. */
  private pickHtml = "";
  /** The families whose tests the custom picker has open. Not part of the view, so not in the hash. */
  private readonly openFams = new Set<string>();
  /**
   * The last blend other than custom that the filter named. Typing "Custom" passes through text
   * that names none, so the blend the filter held a keystroke ago is not the one custom was chosen from.
   */
  private fromBlend: BlendId = "all";

  constructor(rb: PageData, data: Data) {
    this.rb = rb;
    this.data = data;
    // From the catalog rather than from the runs that happen to be loaded: the chips are a
    // filter and the set they offer should not grow as fetches land.
    this.langs = [...new Set(data.manifest.flatMap((m) => m.languages))].sort();
    this.st = initialState(data.hosts[0] ?? DEFAULT_HOST, this.langs);
  }

  start(): void {
    this.wire();
    readHash(this.st, location.hash);
    // The blend view opens on All, which the filter shows, as the others open on a family or test.
    if (this.st.gran === "blend") this.st.q = filterFor(this.latest(), "blend", null, this.st.q);
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

  private wireKey(language: string, name: string): string | null {
    const run = this.latest();
    return wireKeyFor(language, name, run ? hostOf(run) : this.st.host, this.data.catalog.wire);
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
      wireOf: (language, name) => {
        const k = this.wireKey(language, name);
        return k ? this.data.wireDoc(k) : undefined;
      },
    });
    return { run, rn, rows: rs };
  }

  private forGran = (c: Col): boolean => !c.gran || c.gran === this.st.gran;

  private visibleCols(): Col[] {
    return COLS.filter((c) => (c.pin || this.st.cols.has(c.id)) && this.forGran(c));
  }

  /* ---- render ---- */

  render = (): void => {
    const { run, rn, rows: rs } = this.rows();
    const cols = series();
    const langs = this.langs;
    const colour = Object.fromEntries(langs.map((l, i) => [l, cols[i % cols.length] ?? cols[0] ?? "#000"])) as Record<string, string>;

    const hosts = this.data.hosts;
    el("host").innerHTML = hosts.map((h) => `<option${h === this.st.host ? " selected" : ""}>${esc(h)}</option>`).join("");
    el("rung").innerHTML = run
      ? rungsOf(run)
          .map((r) => `<option value="${esc(r)}"${r === rn ? " selected" : ""}>${esc(rateLabel(run, r))}</option>`)
          .join("")
      : "";
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
    const q = el<HTMLInputElement>("q");
    q.value = this.st.q;
    q.placeholder = `${this.st.gran} or framework`;
    // Written only when the names change, so typing in the filter does not rebuild the list
    // it is suggesting from.
    const opts = choicesAt(run, this.st.gran, rn)
      .map((c) => `<option value="${esc(c)}"></option>`)
      .join("");
    if (opts !== this.qopts) el("qopts").innerHTML = this.qopts = opts;

    this.renderHostNote();
    this.renderRunNote(run);
    this.renderBlend(run);

    if (!run) {
      el("meta").textContent = this.data.missing(this.st.host) ? "loading this host…" : "no runs for this host yet";
      el("thead").innerHTML = "";
      el("tbody").innerHTML = "";
      el("time").innerHTML = '<p class="empty">No data.</p>';
      el("machine").innerHTML = "";
      this.pushHash();
      return;
    }

    el("meta").textContent =
      this.blendStatus(run) +
      `${run.date ?? ""} · ${run.machine?.cpu ?? "?"}, ${run.machine?.cores ?? "?"} cores · ${hostOf(run)}` +
      ` · ${run.ladder ?? "rate ladder"} · ${rs.length} rows · click a row for its framework page`;
    this.fetchWire(run);

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
    const data = new URLSearchParams(location.search).get("data");
    // The rate goes into the link even when it is the default, because the page opens on the
    // rate it is handed and cannot work out which one this table defaulted to.
    const view: State = { ...this.st, rung: rn };
    el("tbody").innerHTML =
      rs
        .map((r, i) => {
          const w = r.value != null && isFinite(r.value) ? Math.max(1.5, (100 * r.value) / worst) : 0;
          const page = this.pageFor(r.id);
          const href = page ? pageHref(page, r.detail, view, this.langs, data) : null;
          const tds = vc
            .map((c) => {
              if (c.id === "bar")
                return `<td class="barcell"><div class="bar" style="width:${w}%;background:${colour[r.language]}"></div></td>`;
              if (c.id === "delta") return deltaCell(r.delta, METRICS[this.st.metric].unit);
              const extra = c.id === "value" && r.dead ? " dead" : "";
              return `<td class="${c.cls ?? ""}${extra}">${esc(cell(c.get?.(r), this.unit(c.id)))}</td>`;
            })
            .join("");
          const name = href ? `<a href="${esc(href)}">${esc(r.label)}</a>` : esc(r.label);
          return `<tr${href ? ` data-href="${esc(href)}"` : ""}>
      <td class="rank">${i + 1}</td>
      <td class="name l"><span class="swatch" style="background:${colour[r.language]}"></span>${name}</td>
      <td class="sub l">${esc(r.detail || r.language)}</td>${tds}</tr>`;
        })
        .join("") || `<tr><td colspan="${vc.length + 3}" class="empty">Nothing matches those filters.</td></tr>`;

    this.renderTime(rs);
    this.pushHash();
  };

  /** What the host is, from the orchestrator's record of it. */
  private renderHostNote(): void {
    const box = el("hostnote");
    const meta = this.rb.hosts[this.st.host];
    box.hidden = !meta;
    if (meta) box.innerHTML = `<strong>${esc(this.st.host)}</strong> &mdash; ${esc(meta.note)}`;
  }

  /**
   * A run that is not recorded is on screen only because the build was asked for it, and a
   * reader has to be told what it is not.
   */
  private renderRunNote(run: Run | null): void {
    const box = el("runnote");
    const why = run && run.recorded !== true ? (run.notRecorded ?? []) : [];
    box.hidden = !run || run.recorded === true;
    if (!box.hidden)
      box.innerHTML =
        `<strong>Not recorded.</strong> This run does not enter the published series` +
        (why.length ? `: ${why.map(esc).join("; ")}.` : ".");
  }

  /* ---- the blend ---- */

  /** The custom picker, and the histograms any blend but All is read from. */
  private renderBlend(run: Run | null): void {
    const blend = blendIn(this.st);
    el("picker").hidden = !run || blend !== "custom";
    if (!run) return;
    if (blend === "custom") this.renderPicker(run, weightsOf(run, blend, this.st.pick));
    // The time axis reads every run on this host, so every loaded run's histograms are fetched.
    if (blend !== "all" && this.data.histMissing(this.st.host)) {
      void this.data.fetchHist(this.st.host).then((got) => {
        if (got) this.render();
      });
    }
  }

  /** Why a blend other than All shows no latency yet, or at all, as the start of the line under the table. */
  private blendStatus(run: Run): string {
    const b = blendIn(this.st);
    if (b === "all") return "";
    if (!this.data.hasHist(run.runId)) return `${labelOf(b)} is read from each test's histogram, and this run's summary has none · `;
    return this.data.histMissing(this.st.host) ? `loading the histograms ${labelOf(b)} is read from… · ` : "";
  }

  /**
   * The custom blend's families, each with how many of its tests are taken, its weight and its
   * share. A family opens to its tests.
   */
  private renderPicker(run: Run, weights: ReadonlyMap<string, number>): void {
    const shares = sharesOf(run, weights);
    const taken = new Set(testsOfPick(run, this.st.pick.entries));
    const byFamily = new Map<string, string[]>();
    for (const id of testOrder(run)) {
      const fam = familyOf(run, id);
      byFamily.set(fam, [...(byFamily.get(fam) ?? []), id]);
    }
    const html = [...byFamily]
      .map(([fam, ids]) => {
        const n = ids.filter((id) => taken.has(id)).length;
        const open = this.openFams.has(fam);
        const share = shares.get(fam);
        const tests = open
          ? `<div class="picktests">${ids
              .map(
                (id) =>
                  `<label><input type="checkbox" data-test="${esc(id)}"${taken.has(id) ? " checked" : ""}>` +
                  `${esc(id.slice(fam.length + 1))}</label>`,
              )
              .join("")}</div>`
          : "";
        return (
          `<div class="pickfam"><label class="famck"><input type="checkbox" data-fam="${esc(fam)}"` +
          `${n === ids.length ? " checked" : ""}${n > 0 && n < ids.length ? ' data-partial=""' : ""}>${esc(fam)}</label>` +
          `<button type="button" class="chip sm" data-open="${esc(fam)}" aria-expanded="${open}" title="tests taken">${n} of ${ids.length}</button>` +
          `<label class="wt">weight <input type="number" min="0" step="0.5" value="${this.st.pick.weights[fam] ?? 1}" data-wt="${esc(fam)}"></label>` +
          `<span class="share">${share ? `${Math.round(share * 100)}%` : "—"}</span>${tests}</div>`
        );
      })
      .join("");
    const box = el("pickfams");
    if (html !== this.pickHtml) box.innerHTML = this.pickHtml = html;
    box.querySelectorAll<HTMLInputElement>("input[data-partial]").forEach((i) => (i.indeterminate = true));
  }

  /* ---- what a row opens ---- */

  /**
   * A framework page is per framework and host, but a row's key carries its slice: node:fastify
   * at blend granularity, node:fastify|json at family. Look the page up by the framework itself,
   * or the link appears on one of the three views and not the other two.
   */
  private pageFor(id: string): string | undefined {
    return this.rb.pages[this.st.host]?.[id];
  }

  /**
   * The wire columns read each framework's captured exchange, which is fetched rather than
   * embedded, so they are fetched once one of those columns is on.
   */
  private fetchWire(run: Run): void {
    if (!this.visibleCols().some((c) => c.wire)) return;
    const keys = run.frameworks
      .filter((f) => this.st.langs.has(f.language))
      .map((f) => this.wireKey(f.language, f.name))
      .filter((k): k is string => k !== null && !this.wireAsked.has(k));
    if (!keys.length) return;
    for (const k of keys) this.wireAsked.add(k);
    void Promise.all(keys.map((k) => this.data.fetchWire(k))).then(this.render);
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
    const newest = this.latest();
    if (!newest) return;
    const machines = machinesFor(this.runsForHost(), newest);
    const machine = machines.find((m) => m.machine === this.st.machine)?.machine ?? machineOf(newest);
    el("machine").innerHTML = machines
      .map(
        (m) =>
          `<option value="${esc(m.machine)}"${m.machine === machine ? " selected" : ""}>` +
          `${esc(m.machine)} · ${m.runs} run${m.runs === 1 ? "" : "s"}</option>`,
      )
      .join("");
    const runs = timeline(this.runsForHost(), newest, machine);
    if (runs.length < 2) {
      box.innerHTML = '<p class="empty">One run on this machine so far. The time axis fills in as runs accumulate.</p>';
      return;
    }
    const keys = rs.slice(0, 6).map((r) => r.key);
    const cols = series();
    // Each point keeps its run's place on the axis, so a run a framework is missing from leaves a
    // gap rather than moving its later points under earlier dates.
    const series_ = new Map<string, { i: number; date: string; v: number; ver: string; adapter: string }[]>();
    for (const [i, run] of runs.entries()) {
      const rn = (this.st.rung && rungsOf(run).includes(this.st.rung) ? this.st.rung : pickRung(run, null)) ?? "";
      const blend = blendIn(this.st);
      const weights = blend !== "all" ? weightsOf(run, blend, this.st.pick) : null;
      for (const f of run.frameworks) {
        for (const k of keys) {
          const [kb, det] = k.split("|");
          if (kb !== f.id) continue;
          const at = !det ? undefined : f.tests?.[det] ? f.tests[det]?.rungs?.[rn] : famsAt(f, rn)[det];
          const raw = (at as Record<string, unknown> | undefined)?.[this.st.metric];
          const v = !det ? blendValue(f, rn, this.st.metric, weights) : typeof raw === "number" ? raw : null;
          if (v == null) continue;
          if (!series_.has(k)) series_.set(k, []);
          series_.get(k)?.push({ i, date: run.date ?? "", v, ver: f.version ?? "", adapter: metaOf(f, "adapter") });
        }
      }
    }
    const live = [...series_.entries()].filter(([, pts]) => pts.length);
    if (!live.length || !live.some(([, pts]) => pts.length > 1)) {
      box.innerHTML = '<p class="empty">Not enough runs yet for these rows.</p>';
      return;
    }

    const W = 940,
      H = 260,
      P = 78,
      R = 52;
    const all = live.flatMap(([, pts]) => pts.map((x) => x.v));
    const lo = Math.min(...all) * 0.92;
    const hi = Math.max(...all) * 1.08;
    const n = runs.length;
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
      g += `<path d="${pts.map((pt, j) => `${j ? "L" : "M"} ${X(pt.i).toFixed(1)} ${Y(pt.v).toFixed(1)}`).join(" ")}" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round"/>`;
      let prev: string | null = null;
      let prevAd: string | null = null;
      pts.forEach((pt) => {
        const i = pt.i;
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
    runs.forEach((run, i) => {
      if (i % step && i !== n - 1) return;
      const anchor = i === 0 ? "start" : i === n - 1 ? "end" : "middle";
      g += `<text x="${X(i).toFixed(1)}" y="${H - 16}" fill="var(--ink3)" font-size="10" font-family="var(--f-mono)" text-anchor="${anchor}">${esc((run.date ?? "").slice(5))}</text>`;
    });
    g += "</svg>";
    const legend = live
      .map(([k], i) => `<span><b style="background:${cols[i % cols.length]}"></b>${esc(k.replace("|", " · "))}</span>`)
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
      this.st.machine = null;
      this.render();
      if (await this.data.fetchHost(this.st.host)) this.render();
    };
    el<HTMLSelectElement>("machine").onchange = (e): void => {
      this.st.machine = (e.target as HTMLSelectElement).value;
      this.render();
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
      const was = this.st.gran === "blend" ? blendNamed(this.st.q) : null;
      if (was && was !== "custom") this.fromBlend = was;
      this.st.q = (e.target as HTMLInputElement).value;
      // Custom opens on the blend it was chosen from, until something has been picked.
      const run = this.latest();
      if (blendIn(this.st) === "custom" && !this.st.pick.entries.length && run)
        this.st.pick.entries = entriesOf(run, weightsOf(run, this.fromBlend, this.st.pick).keys());
      this.render();
    };
    document.querySelectorAll<HTMLButtonElement>(".seg button[data-gran]").forEach((b) => {
      b.onclick = (): void => {
        const g = b.dataset["gran"];
        if (g === "blend" || g === "family" || g === "test") {
          const run = this.latest();
          this.st.q = filterFor(run, g, pickRung(run, this.st.rung), this.st.q);
          this.st.gran = g;
        }
        this.render();
      };
    });
    el("picker").onclick = (e): void => {
      const t = e.target as HTMLElement;
      const open = t.closest<HTMLElement>("[data-open]")?.dataset["open"];
      if (open !== undefined) {
        if (this.openFams.has(open)) this.openFams.delete(open);
        else this.openFams.add(open);
        this.render();
        return;
      }
      const from = t.closest<HTMLElement>("[data-from]")?.dataset["from"];
      const run = this.latest();
      if (from === undefined || !run) return;
      this.st.pick.entries = isBlend(from) ? entriesOf(run, weightsOf(run, from, this.st.pick).keys()) : [];
      this.render();
    };
    el("picker").onchange = (e): void => {
      const t = e.target as HTMLInputElement;
      const run = this.latest();
      if (!run) return;
      const { fam, test, wt } = t.dataset;
      if (wt !== undefined) {
        const n = Number(t.value);
        if (Number.isFinite(n) && n >= 0) {
          if (n === 1) delete this.st.pick.weights[wt];
          else this.st.pick.weights[wt] = n;
        }
        this.render();
        return;
      }
      const taken = new Set(testsOfPick(run, this.st.pick.entries));
      const flip = (id: string): void => {
        if (t.checked) taken.add(id);
        else taken.delete(id);
      };
      if (fam !== undefined) testOrder(run).filter((id) => familyOf(run, id) === fam).forEach(flip);
      else if (test !== undefined) flip(test);
      else return;
      this.st.pick.entries = entriesOf(run, taken);
      this.render();
    };
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
      // The name is a link and the browser handles a click on it, modifier keys included.
      if ((e.target as HTMLElement).closest("a")) return;
      const href = (e.target as HTMLElement).closest<HTMLElement>("tr[data-href]")?.dataset["href"];
      if (!href) return;
      if (e.metaKey || e.ctrlKey) open(href, "_blank");
      else location.assign(href);
    };
    el("reset").onclick = (): void => {
      const run = this.latest();
      this.st.langs = new Set(this.langs);
      this.st.rung = null;
      this.st.q = filterFor(run, this.st.gran, pickRung(run, null), "");
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
