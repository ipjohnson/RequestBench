// The tests overview: a family's card opens the family's tests below the card's row, one family at
// a time, and the address names what is open so a link can open it again.
//
// Each family's tests sit in the grid right after its card and span every column. The grid packs
// densely, so the cards after an open family still fill out the card's row before the tests begin.

const cards = (): HTMLAnchorElement[] => [...document.querySelectorAll<HTMLAnchorElement>("a.famcard[data-family]")];
const cardOf = (family: string): HTMLElement | null => document.querySelector(`a.famcard[data-family="${CSS.escape(family)}"]`);
const testsOf = (family: string): HTMLElement | null => document.querySelector(`[data-tests="${CSS.escape(family)}"]`);

/**
 * Opens `family`, or closes every family when it is null. `keep` stays where it was on the screen,
 * because closing a family above it would otherwise pull it up out of view.
 */
function show(family: string | null, keep?: HTMLElement): void {
  const before = keep?.getBoundingClientRect().top;
  for (const card of cards()) {
    const name = card.dataset["family"] ?? "";
    card.setAttribute("aria-expanded", String(name === family));
    const tests = testsOf(name);
    if (tests) tests.hidden = name !== family;
  }
  if (keep && before !== undefined) window.scrollBy(0, keep.getBoundingClientRect().top - before);
}

/** The family a hash names, by its own name or by one of its tests, and that test's section. */
function named(hash: string): { family: string; test: HTMLElement | null } | null {
  const id = decodeURIComponent(hash.slice(1));
  const el = id ? document.getElementById(id) : null;
  if (el instanceof HTMLAnchorElement && el.dataset["family"]) return { family: el.dataset["family"], test: null };
  const tests = el?.closest<HTMLElement>("[data-tests]");
  return tests?.dataset["tests"] ? { family: tests.dataset["tests"], test: el } : null;
}

function follow(): void {
  const at = named(location.hash);
  if (!at) return;
  show(at.family);
  (at.test ?? cardOf(at.family))?.scrollIntoView();
}

const address = (family: string | null): void =>
  history.replaceState(null, "", family ? `#${family}` : location.pathname + location.search);

export function start(): void {
  for (const card of cards()) {
    const name = card.dataset["family"] ?? "";
    card.setAttribute("aria-controls", testsOf(name)?.id ?? "");
    card.setAttribute("aria-expanded", "false");
    card.addEventListener("click", (e) => {
      // A modifier key still opens the family's own page, in a new tab or window.
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      const open = card.getAttribute("aria-expanded") !== "true" ? name : null;
      show(open, card);
      address(open);
      // A card at the foot of the screen would open its tests out of sight.
      const top = testsOf(name)?.getBoundingClientRect().top ?? 0;
      if (open && top > innerHeight * 0.8) card.scrollIntoView();
    });
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>("button[data-close]")) {
    button.addEventListener("click", () => {
      show(null);
      address(null);
      cardOf(button.dataset["close"] ?? "")?.scrollIntoView({ block: "nearest" });
    });
  }
  window.addEventListener("hashchange", follow);
  follow();
}
