// The test tree on a framework page, and the ways of reading it.
//
// The panes are all in the page; the tree only chooses which one is shown. The hash carries the
// choice, a test id or a family name, so a link to either opens on it.
//
// Info and Distribution are two views of the same list. The grid's rows carry the same test ids
// the tree does, so picking one there opens its pane here rather than being a separate
// selection the reader has to reconcile.
//
// The rate and the comparison are picked once for the whole panel, beside the tabs. So is the
// chart under each test's numbers, its histogram or its latency over time.
import { esc } from "../lib/html.ts";
import { cell, type Unit } from "../lib/metrics.ts";
import type { Run, WireDoc } from "../lib/types.ts";
import { cmpCell, peerPop, unfinished } from "../lib/views.ts";
import { addPick, BASE, dropPick, familyAt, frameworkOf, MAX, readVs, statOf, testAt, writeVs, type Pick } from "./compare.ts";
import { fetchJson } from "./fetch-json.ts";

export function startTree(): void {
  const links = [...document.querySelectorAll<HTMLElement>(".eplink, .distrow, .famep, .epfamname[data-fam]")];
  const panes = [...document.querySelectorAll<HTMLElement>(".eppane")];
  if (!links.length) return;
  const idOf = (e: HTMLElement): string => e.dataset["ep"] ?? e.dataset["fam"] ?? "";

  const bar = document.querySelector<HTMLElement>(".eptabs");
  const tabs = [...document.querySelectorAll<HTMLButtonElement>(".eptabs [role=tab]")];
  const view = (id: string): HTMLElement | null =>
    document.getElementById(tabs.find((t) => t.id === id)?.getAttribute("aria-controls") ?? "");

  const pick = (tab: HTMLButtonElement, focus = false): void => {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      // Roving tabindex: a tablist is one stop in the tab order and the arrows move within
      // it, so Tab from the heading lands on the open tab rather than walking through both.
      t.tabIndex = on ? 0 : -1;
      const v = view(t.id);
      if (v) v.hidden = !on;
    }
    // The comparison is drawn on the panes and not on the grid, so the grid's view hides it.
    bar?.setAttribute("data-view", tab.getAttribute("aria-controls") ?? "");
    if (focus) tab.focus();
  };

  for (const [i, t] of tabs.entries()) {
    t.addEventListener("click", () => pick(t));
    t.addEventListener("keydown", (ev) => {
      const step = ev.key === "ArrowRight" ? 1 : ev.key === "ArrowLeft" ? -1 : 0;
      const to = step
        ? tabs[(i + step + tabs.length) % tabs.length]
        : ev.key === "Home"
          ? tabs[0]
          : ev.key === "End"
            ? tabs[tabs.length - 1]
            : null;
      if (!to) return;
      ev.preventDefault();
      pick(to, true);
    });
  }
  if (tabs[0]) pick(tabs.find((t) => t.getAttribute("aria-selected") === "true") ?? tabs[0]);

  // The rate switches the whole panel at once: the grid, the percentile table on every pane
  // and the histogram under it. Letting it move only the grid would leave one rate's shapes
  // beside another rate's numbers, which is the one reading of this page that would be wrong.
  const rateBtns = [...document.querySelectorAll<HTMLButtonElement>(".eprate-pick")];
  // A rate the framework did not complete has no latencies to show. Its button stays hoverable
  // so its title can say why, and neither a click nor a link's rung switches to it.
  const pickable = rateBtns.filter((b) => b.getAttribute("aria-disabled") !== "true");
  // The blocks that belong to a rate, not everything carrying the attribute: the buttons are
  // keyed by rung too, and a bare [data-rung] hides the one being switched away from.
  const atRate = [...document.querySelectorAll<HTMLElement>(".dist[data-rung], .eprate[data-rung]")];
  const setRate = (rn: string): void => {
    for (const b of rateBtns) b.setAttribute("aria-pressed", String(b.dataset["rung"] === rn));
    for (const e of atRate) e.hidden = e.dataset["rung"] !== rn;
  };
  for (const b of pickable) b.addEventListener("click", () => setRate(b.dataset["rung"] ?? ""));
  // Opened from a row, the page starts on the rate the row was read at. A rung is a name in one
  // run's ladder, so it names this page's rate only when the row was on this page's host.
  const from = new URLSearchParams(location.search);
  const rung = from.get("rung");
  const host = document.querySelector<HTMLElement>(".eprates")?.dataset["host"];
  if (rung && from.get("host") === host && pickable.some((b) => b.dataset["rung"] === rung)) setRate(rung);

  // Every pane at every rate has its own pair of chart tabs, and a pick in one is a pick in all of
  // them, so a reader stepping through the tree for a climb keeps reading climbs.
  const chartTabs = [...document.querySelectorAll<HTMLButtonElement>(".epcharttabs [role=tab]")];
  const setChart = (chart: string): void => {
    for (const t of chartTabs) {
      const on = t.dataset["chart"] === chart;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(t.getAttribute("aria-controls") ?? "");
      if (panel) panel.hidden = !on;
    }
  };
  for (const t of chartTabs) {
    t.addEventListener("click", () => setChart(t.dataset["chart"] ?? ""));
    t.addEventListener("keydown", (ev) => {
      const own = [...(t.parentElement?.querySelectorAll<HTMLButtonElement>("[role=tab]") ?? [])];
      const i = own.indexOf(t);
      const step = ev.key === "ArrowRight" ? 1 : ev.key === "ArrowLeft" ? -1 : 0;
      const to = step
        ? own[(i + step + own.length) % own.length]
        : ev.key === "Home"
          ? own[0]
          : ev.key === "End"
            ? own[own.length - 1]
            : null;
      if (!to) return;
      ev.preventDefault();
      setChart(to.dataset["chart"] ?? "");
      to.focus();
    });
  }

  // What a compared number differs by, and why. One popup for the page, filled from the
  // number's template and placed by script rather than by CSS, so it can shift to stay on
  // screen from whichever column it opens.
  const pop = document.createElement("div");
  pop.className = "basepop";
  pop.id = "basepop";
  pop.setAttribute("role", "tooltip");
  pop.hidden = true;
  document.body.append(pop);
  const openPop = (cell: HTMLElement): void => {
    const tpl = cell.querySelector("template");
    if (!tpl) return;
    pop.replaceChildren(tpl.content.cloneNode(true));
    pop.hidden = false;
    const r = cell.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left, document.documentElement.clientWidth - pop.offsetWidth - 8));
    const below = r.bottom + 6 + pop.offsetHeight <= innerHeight;
    pop.style.left = `${left + scrollX}px`;
    pop.style.top = `${(below ? r.bottom + 6 : r.top - 6 - pop.offsetHeight) + scrollY}px`;
    cell.setAttribute("aria-describedby", pop.id);
  };
  const closePop = (cell: HTMLElement): void => {
    pop.hidden = true;
    cell.removeAttribute("aria-describedby");
  };
  // Listened for on the document rather than per number, because another framework's numbers
  // are written after the page loads and replaced whenever the comparison changes. A mouse
  // opens it by hovering. A key or a touch opens it by focusing the number, and a touch's
  // pointer leaves as soon as the finger lifts, so only the mouse's leaving closes it.
  const popCell = (t: EventTarget | null): HTMLElement | null =>
    t instanceof Element ? t.closest<HTMLElement>(".fb[tabindex]") : null;
  addEventListener("pointerover", (ev) => {
    const cell = popCell(ev.target);
    if (cell && ev.pointerType === "mouse") openPop(cell);
  });
  addEventListener("pointerout", (ev) => {
    const cell = popCell(ev.target);
    const into = ev.relatedTarget instanceof Node && cell?.contains(ev.relatedTarget);
    if (cell && ev.pointerType === "mouse" && !into) closePop(cell);
  });
  addEventListener("focusin", (ev) => {
    const cell = popCell(ev.target);
    if (cell) openPop(cell);
  });
  addEventListener("focusout", (ev) => {
    const cell = popCell(ev.target);
    if (cell) closePop(cell);
  });
  addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") pop.hidden = true;
  });

  startCompare(() => {
    pop.hidden = true;
  });

  const show = (id: string): boolean => {
    let hit = false;
    for (const p of panes) {
      const on = idOf(p) === id;
      p.hidden = !on;
      hit ||= on;
    }
    for (const a of links) a.setAttribute("aria-current", String(idOf(a) === id));
    return hit;
  };

  for (const a of links) {
    a.addEventListener("click", (ev) => {
      ev.preventDefault();
      const id = idOf(a);
      history.replaceState(null, "", `#${encodeURIComponent(id)}`);
      show(id);
      // Picking a row in the grid is a request to read that test, so it lands on the pane
      // rather than leaving the reader on the grid wondering what it did.
      if (a.classList.contains("distrow") && tabs[0]) pick(tabs[0]);
    });
  }

  const wanted = decodeURIComponent(location.hash.slice(1));
  if (!wanted || !show(wanted)) show(document.querySelector<HTMLElement>(".eplink")?.dataset["ep"] ?? "");
  addEventListener("hashchange", () => show(decodeURIComponent(location.hash.slice(1))));
}

/**
 * What the page's numbers are compared with. It is a way of reading the whole page, like the
 * rate, so it is picked once beside the rate and every pane shows it at every rate. The reader
 * keeps it while walking the tree, and the query keeps it for a link or a reload.
 *
 * The base's numbers are in the page and only shown. Another framework's are written under each
 * number once the run's document has been read, one row per pick in the order picked.
 */
function startCompare(changed: () => void): void {
  const ctl = document.querySelector<HTMLElement>(".cmp");
  const add = ctl?.querySelector<HTMLSelectElement>(".cmpadd");
  const chips = ctl?.querySelector<HTMLElement>(".cmpchips");
  const status = ctl?.querySelector<HTMLElement>(".cmpstatus");
  if (!ctl || !add || !chips || !status) return;

  const opts = new Map([...add.options].filter((o) => o.value).map((o) => [o.value, o]));
  const nameOf = (id: string): string => opts.get(id)?.dataset["name"] ?? id;
  const panes = [...document.querySelectorAll<HTMLElement>(".eppane")];
  let picks = readVs(location.search, new Set(opts.keys()));

  // One read of the run however many frameworks are picked, and one of each framework's wire
  // capture for its response sizes. A framework is drawn only once both have settled, so its
  // row never appears with the sizes missing and then fills in.
  let run: Run | null | undefined;
  let runRead: Promise<void> | undefined;
  const wire = new Map<string, WireDoc | null>();
  const wireRead = new Map<string, Promise<void>>();
  const readWire = async (id: string): Promise<void> => {
    const at = opts.get(id)?.dataset["wire"];
    wire.set(id, at ? await fetchJson<WireDoc>(new URL(at, location.href)).catch(() => null) : null);
  };
  const load = (ids: string[]): Promise<unknown> =>
    Promise.all([
      (runRead ??= fetchJson<Run>(new URL(ctl.dataset["run"] ?? "", location.href))
        .catch(() => null)
        .then((r) => {
          run = r;
        })),
      ...ids.map((id) => {
        let p = wireRead.get(id);
        if (!p) wireRead.set(id, (p = readWire(id)));
        return p;
      }),
    ]);

  /** Another framework's number under one of this page's, or null until its data is read. */
  const peerCell = (id: string, row: HTMLElement, pane: HTMLElement, rn: string): HTMLElement | null => {
    const f = run ? frameworkOf(run, id) : undefined;
    if (!f || !wire.has(id)) return null;
    const k = row.dataset["k"] ?? "";
    const test = pane.dataset["ep"];
    const name = nameOf(id);
    const unit: Unit = k.endsWith("Us") ? "us" : k === "sbz" ? "B" : "";
    // The size is the wire capture's, which no rate changes.
    const v =
      k === "sbz"
        ? (wire.get(id)?.tests[test ?? ""]?.sbz ?? null)
        : statOf(test ? testAt(f, test, rn) : familyAt(f, pane.dataset["fam"] ?? "", rn), k);
    const own = row.dataset["v"] === undefined ? null : Number(row.dataset["v"]);
    const level = unit === "us" ? (row.querySelector(".fk")?.textContent ?? "") : "";
    const pop = unit && own !== null && v !== null ? peerPop(own, v, unit, name, level) : null;
    const why =
      v !== null ? undefined
      : k === "sbz" ? `No captured exchange for ${name}.`
      : (unfinished(name, f.rungs[rn]) ?? `${name} has no number for this at this rate.`);
    const tpl = document.createElement("template");
    tpl.innerHTML = cmpCell(id, cell(v, unit), pop, why);
    return tpl.content.firstElementChild instanceof HTMLElement ? tpl.content.firstElementChild : null;
  };

  const fill = (): void => {
    for (const e of document.querySelectorAll(".fb:not([data-cmp='base'])")) e.remove();
    for (const pane of panes) {
      for (const block of pane.querySelectorAll<HTMLElement>(".eprate[data-rung]")) {
        const rn = block.dataset["rung"] ?? "";
        for (const row of block.querySelectorAll<HTMLElement>(".frow[data-k]")) {
          const base = row.querySelector<HTMLElement>(".fb[data-cmp='base']");
          if (base) base.hidden = true;
          for (const x of picks) {
            const at = x.id === BASE ? base : peerCell(x.id, row, pane, rn);
            if (!at) continue;
            at.dataset["slot"] = String(x.slot);
            at.hidden = false;
            row.append(at);
          }
        }
      }
    }
  };

  const keyItem = (x: Pick, label: string, title: string): string =>
    `<span class="cmpk" data-slot="${x.slot}" title="${esc(title)}"><i></i>${esc(label)}</span>`;
  const noBase =
    `<span class="cmpk none" title="This test roots its chain, so it has no base to be ` +
    `read against.">no base</span>`;
  const paintKeys = (): void => {
    for (const pane of panes) {
      const key = pane.querySelector<HTMLElement>(".cmpkey");
      if (!key) continue;
      const base = pane.dataset["base"];
      const items = picks.flatMap((x): string[] => {
        const name = nameOf(x.id);
        if (x.id !== BASE) {
          const title = `What ${name} measured at the same rate in the same run. Hover a number for the difference.`;
          return [keyItem(x, name, title)];
        }
        // A family is a merge of its tests and never has a base, so its key leaves it out.
        if (pane.dataset["fam"] !== undefined) return [];
        if (!base) return [noBase];
        const title = `${base} is this test's base. Hover a number for the difference and each factor between them.`;
        return [keyItem(x, base, title)];
      });
      key.innerHTML = items.length ? `<span class="cmplabel">vs</span>${items.join("")}` : "";
      key.hidden = !items.length;
    }
  };

  const paintControl = (): void => {
    chips.innerHTML = picks
      .map((x) => {
        const name = nameOf(x.id);
        return (
          `<button type="button" class="cmpchip" data-id="${esc(x.id)}" data-slot="${x.slot}" ` +
          `title="${esc(opts.get(x.id)?.title ?? name)}" aria-label="${esc(`Stop comparing with ${name}`)}">` +
          `<i></i>${esc(name)}<span class="cmpx" aria-hidden="true">&times;</span></button>`
        );
      })
      .join("");
    for (const o of opts.values()) o.disabled = picks.some((x) => x.id === o.value);
    const full = picks.length >= MAX;
    add.disabled = full;
    add.title = full ? `${MAX} at most. Remove one to pick another.` : "";
    add.value = "";
  };

  let generation = 0;
  const apply = async (): Promise<void> => {
    const mine = (generation += 1);
    changed();
    paintControl();
    paintKeys();
    fill();
    const peers = picks.filter((x) => x.id !== BASE).map((x) => x.id);
    if (!peers.length || (run !== undefined && peers.every((id) => wire.has(id)))) {
      status.textContent = run === null && peers.length ? "Could not read the other frameworks' numbers." : "";
      return;
    }
    status.textContent = "loading…";
    await load(peers);
    if (mine !== generation) return;
    status.textContent = run ? "" : "Could not read the other frameworks' numbers.";
    changed();
    fill();
  };
  const set = (next: Pick[]): void => {
    picks = next;
    history.replaceState(null, "", `${location.pathname}${writeVs(location.search, picks)}${location.hash}`);
    void apply();
  };

  add.addEventListener("change", () => {
    if (add.value) set(addPick(picks, add.value));
  });
  chips.addEventListener("click", (ev) => {
    const chip = ev.target instanceof Element ? ev.target.closest<HTMLElement>(".cmpchip") : null;
    if (!chip) return;
    const i = [...chips.children].indexOf(chip);
    set(dropPick(picks, chip.dataset["id"] ?? ""));
    // The chip is gone, so focus goes to the one that took its place rather than to the page.
    const next = chips.children[i] ?? chips.children[i - 1];
    (next instanceof HTMLElement ? next : add).focus();
  });

  ctl.hidden = false;
  void apply();
}
