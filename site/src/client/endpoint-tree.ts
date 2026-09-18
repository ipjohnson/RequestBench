// The endpoint tree on a framework page, and the two ways of reading it.
//
// The panes are all in the page; the tree only chooses which one is shown. The hash carries
// the choice, so a link to one endpoint opens on it.
//
// Info and Distribution are two views of the same list. The grid's rows carry the same
// endpoint ids the tree does, so picking one there opens its pane here rather than being a
// separate selection the reader has to reconcile.
export function startTree(): void {
  const links = [...document.querySelectorAll<HTMLElement>(".eplink, .distrow")];
  const panes = [...document.querySelectorAll<HTMLElement>(".eppane")];
  if (!links.length) return;

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
  // and the histogram under it. Letting it move only the grid would leave 5,000 rps shapes
  // beside 1,000 rps numbers, which is the one reading of this page that would be wrong.
  const rateBtns = [...document.querySelectorAll<HTMLButtonElement>(".eprate-pick")];
  // The blocks that belong to a rate, not everything carrying the attribute: the buttons
  // are keyed by rung too, and a bare [data-rung] hides the one being switched away from.
  const atRate = [...document.querySelectorAll<HTMLElement>(".dist[data-rung], .eprate[data-rung]")];
  const setRate = (rn: string): void => {
    for (const b of rateBtns) b.setAttribute("aria-pressed", String(b.dataset["rung"] === rn));
    for (const e of atRate) e.hidden = e.dataset["rung"] !== rn;
  };
  for (const b of rateBtns) b.addEventListener("click", () => setRate(b.dataset["rung"] ?? ""));

  const show = (id: string): boolean => {
    let hit = false;
    for (const p of panes) {
      const on = p.dataset["ep"] === id;
      p.hidden = !on;
      hit ||= on;
    }
    for (const a of links) a.setAttribute("aria-current", String(a.dataset["ep"] === id));
    return hit;
  };

  for (const a of links) {
    a.addEventListener("click", (ev) => {
      ev.preventDefault();
      const id = a.dataset["ep"] ?? "";
      history.replaceState(null, "", `#${encodeURIComponent(id)}`);
      show(id);
      // Picking a row in the grid is a request to read that endpoint, so it lands on the
      // pane rather than leaving the reader on the grid wondering what it did.
      if (a.classList.contains("distrow") && tabs[0]) pick(tabs[0]);
    });
  }

  const wanted = decodeURIComponent(location.hash.slice(1));
  if (!wanted || !show(wanted)) show(links[0]?.dataset["ep"] ?? "");
  addEventListener("hashchange", () => show(decodeURIComponent(location.hash.slice(1))));
}
