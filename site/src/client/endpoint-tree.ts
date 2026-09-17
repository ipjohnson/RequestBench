// The endpoint tree on a framework page.
//
// The panes are all in the page; the tree only chooses which one is shown. The hash carries
// the choice, so a link to one endpoint opens on it.
export function startTree(): void {
  const links = [...document.querySelectorAll<HTMLAnchorElement>(".eplink")];
  const panes = [...document.querySelectorAll<HTMLElement>(".eppane")];
  if (!links.length) return;

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
    });
  }

  const wanted = decodeURIComponent(location.hash.slice(1));
  if (!wanted || !show(wanted)) show(links[0]?.dataset["ep"] ?? "");
  addEventListener("hashchange", () => show(decodeURIComponent(location.hash.slice(1))));
}
