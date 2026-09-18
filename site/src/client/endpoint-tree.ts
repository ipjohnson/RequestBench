// The endpoint tree on a framework page, and the two ways of reading it.
//
// The panes are all in the page; the tree only chooses which one is shown. The hash carries
// the choice, an endpoint id or a family name, so a link to either opens on it.
//
// Info and Distribution are two views of the same list. The grid's rows carry the same
// endpoint ids the tree does, so picking one there opens its pane here rather than being a
// separate selection the reader has to reconcile.
export function startTree(): void {
  const links = [...document.querySelectorAll<HTMLElement>(".eplink, .distrow, .famep, .epfamname[data-fam]")];
  const panes = [...document.querySelectorAll<HTMLElement>(".eppane")];
  if (!links.length) return;
  const idOf = (e: HTMLElement): string => e.dataset["ep"] ?? e.dataset["fam"] ?? "";

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
  // A rate the target did not complete has no latencies to show. Its button stays hoverable
  // so its title can say why, and neither a click nor a link's rung switches to it.
  const pickable = rateBtns.filter((b) => b.getAttribute("aria-disabled") !== "true");
  // The blocks that belong to a rate, not everything carrying the attribute: the buttons
  // are keyed by rung too, and a bare [data-rung] hides the one being switched away from.
  const atRate = [...document.querySelectorAll<HTMLElement>(".dist[data-rung], .eprate[data-rung]")];
  const setRate = (rn: string): void => {
    for (const b of rateBtns) b.setAttribute("aria-pressed", String(b.dataset["rung"] === rn));
    for (const e of atRate) e.hidden = e.dataset["rung"] !== rn;
  };
  for (const b of pickable) b.addEventListener("click", () => setRate(b.dataset["rung"] ?? ""));
  // Opened from a row, the page starts on the rate the row was read at. A rung is an index into
  // one run's ladder, so it names this page's rate only when the row was on this page's host.
  const from = new URLSearchParams(location.search);
  const rung = from.get("rung");
  const host = document.querySelector<HTMLElement>(".eprates")?.dataset["host"];
  if (rung && from.get("host") === host && pickable.some((b) => b.dataset["rung"] === rung)) setRate(rung);

  // The comparison with the base is a way of reading the page, like the rate, so opening it on
  // one pane opens it on every pane and at every rate. It stays open while the reader walks
  // the tree rather than closing on each endpoint.
  const baseBtns = [...document.querySelectorAll<HTMLButtonElement>(".basetoggle")];
  const baseCells = [...document.querySelectorAll<HTMLElement>(".fb")];
  const setBase = (open: boolean): void => {
    for (const b of baseBtns) b.setAttribute("aria-expanded", String(open));
    for (const e of baseCells) e.hidden = !open;
  };
  for (const b of baseBtns)
    b.addEventListener("click", () => setBase(b.getAttribute("aria-expanded") !== "true"));

  // What a base number differs by, and why. One popup for the page, filled from the number's
  // template and placed by script rather than by CSS, so it can shift to stay on screen from
  // whichever column it opens.
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
  for (const cell of baseCells.filter((c) => c.querySelector("template"))) {
    // A mouse opens it by hovering. A key or a touch opens it by focusing the number, and a
    // touch's pointer leaves as soon as the finger lifts, so only the mouse's leaving closes it.
    cell.addEventListener("pointerenter", (ev) => {
      if (ev.pointerType === "mouse") openPop(cell);
    });
    cell.addEventListener("pointerleave", (ev) => {
      if (ev.pointerType === "mouse") closePop(cell);
    });
    cell.addEventListener("focus", () => openPop(cell));
    cell.addEventListener("blur", () => closePop(cell));
  }
  addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") pop.hidden = true;
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
      // Picking a row in the grid is a request to read that endpoint, so it lands on the
      // pane rather than leaving the reader on the grid wondering what it did.
      if (a.classList.contains("distrow") && tabs[0]) pick(tabs[0]);
    });
  }

  const wanted = decodeURIComponent(location.hash.slice(1));
  if (!wanted || !show(wanted)) show(document.querySelector<HTMLElement>(".eplink")?.dataset["ep"] ?? "");
  addEventListener("hashchange", () => show(decodeURIComponent(location.hash.slice(1))));
}
