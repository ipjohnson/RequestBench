// A text field with a list of suggestions the page draws itself, in the ARIA combobox pattern.
//
// A <datalist> is drawn by the browser, which lists only the names that match what the field
// already holds. The explorer's filter always holds a name, so its list offered that one name.
// This list opens on every choice, narrows as the reader types, and groups its choices.
//
// Focus stays in the field. aria-activedescendant names the option the arrow keys have reached,
// and aria-current marks the value the field stands for. What the choices are, and what picking
// one does, is the caller's.
import { esc } from "../lib/html.ts";

export interface Choice {
  readonly value: string;
  /** What the list writes, when it is not the value. */
  readonly label?: string;
  /** A second, quieter word beside the label, such as a framework's language. */
  readonly hint?: string;
  readonly title?: string;
  /** Listed and not pickable, such as a framework already compared. */
  readonly disabled?: boolean;
}

export interface Group {
  readonly label: string;
  readonly choices: readonly Choice[];
}

const labelOf = (c: Choice): string => c.label ?? c.value;

/** The groups with only the choices whose label holds `text`, ignoring case. A group left empty goes. */
export function narrow(groups: readonly Group[], text: string): Group[] {
  const want = text.trim().toLowerCase();
  return groups
    .map((g) => ({ label: g.label, choices: want ? g.choices.filter((c) => labelOf(c).toLowerCase().includes(want)) : g.choices }))
    .filter((g) => g.choices.length > 0);
}

/** A label as HTML, with the first stretch that matches `text`, ignoring case, in a <mark>. */
export function marked(label: string, text: string): string {
  const want = text.trim().toLowerCase();
  const at = want ? label.toLowerCase().indexOf(want) : -1;
  if (at < 0) return esc(label);
  const end = at + want.length;
  return `${esc(label.slice(0, at))}<mark>${esc(label.slice(at, end))}</mark>${esc(label.slice(end))}`;
}

export interface ComboboxOptions {
  /** What the list offers, read each time it is drawn. */
  readonly groups: () => readonly Group[];
  /** The value the field stands for, which the list marks. */
  readonly current?: () => string;
  /** A choice taken with Enter or a click. */
  readonly pick: (value: string) => void;
  /** Whether a pick is left in the field, as a filter's is. Otherwise the field is emptied. */
  readonly keep: boolean;
  /** The field emptied with its clear button. */
  readonly cleared?: () => void;
}

let made = 0;

export class Combobox {
  private readonly input: HTMLInputElement;
  private readonly list: HTMLElement;
  private readonly clear: HTMLButtonElement | null;
  private readonly o: ComboboxOptions;
  /** The options as drawn, in order, pickable or not. */
  private shown: HTMLElement[] = [];
  private active = -1;
  /** Focus lists every choice, and typing narrows the list to what was typed. */
  private narrowing = false;
  /** A focus the page gave, rather than the reader, which opens nothing. */
  private quiet = false;

  constructor(root: HTMLElement, o: ComboboxOptions) {
    const input = root.querySelector<HTMLInputElement>("input");
    const list = root.querySelector<HTMLElement>(".combolist");
    if (!input || !list) throw new Error("a combobox needs an input and a .combolist");
    this.input = input;
    this.list = list;
    this.clear = root.querySelector<HTMLButtonElement>(".comboclear");
    this.o = o;

    list.id ||= `combo-${(made += 1)}`;
    list.setAttribute("role", "listbox");
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-controls", list.id);
    input.setAttribute("aria-expanded", "false");

    input.addEventListener("focus", () => {
      if (this.quiet) this.quiet = false;
      else this.open(false);
    });
    input.addEventListener("click", () => {
      if (!this.isOpen()) this.open(false);
    });
    input.addEventListener("input", () => {
      this.open(true);
      this.refresh();
    });
    input.addEventListener("blur", () => this.close());
    input.addEventListener("keydown", (e) => this.key(e));
    // A press in the list would take focus from the field and close the list before the click.
    list.addEventListener("mousedown", (e) => e.preventDefault());
    list.addEventListener("click", (e) => {
      const option = e.target instanceof Element ? e.target.closest<HTMLElement>('[role="option"]') : null;
      if (option) this.take(option);
    });
    list.addEventListener("mousemove", (e) => {
      const option = e.target instanceof Element ? e.target.closest<HTMLElement>('[role="option"]') : null;
      const i = option ? this.shown.indexOf(option) : -1;
      if (i >= 0 && i !== this.active && !disabled(option)) this.setActive(i, false);
    });
    this.clear?.addEventListener("mousedown", (e) => e.preventDefault());
    this.clear?.addEventListener("click", () => {
      input.value = "";
      this.o.cleared?.();
      this.refresh();
      input.focus();
      this.open(false);
    });
    this.refresh();
  }

  /** After the caller writes the field or its choices change, so the clear button and an open list follow. */
  refresh(): void {
    if (this.clear) this.clear.hidden = !this.input.value || this.input.disabled;
    if (this.isOpen()) this.draw();
  }

  /** Focus the field without opening the list, as when the page moves focus after a removal. */
  focus(): void {
    if (document.activeElement === this.input) return;
    this.quiet = true;
    this.input.focus();
  }

  private isOpen(): boolean {
    return this.input.getAttribute("aria-expanded") === "true";
  }

  private open(narrowing: boolean): void {
    if (this.input.disabled) return;
    this.narrowing = narrowing;
    this.draw();
  }

  private close(): void {
    this.input.setAttribute("aria-expanded", "false");
    this.input.removeAttribute("aria-activedescendant");
    this.list.hidden = true;
    this.shown = [];
    this.active = -1;
  }

  private draw(): void {
    const text = this.narrowing ? this.input.value : "";
    const groups = narrow(this.o.groups(), text);
    if (!groups.length) {
      this.close();
      return;
    }
    const current = this.o.current?.() ?? "";
    const was = this.shown[this.active]?.dataset["value"];
    let n = 0;
    this.list.innerHTML = groups
      .map((g, gi) => {
        const head = `${this.list.id}-g${gi}`;
        const options = g.choices
          .map((c) => {
            const id = `${this.list.id}-o${(n += 1)}`;
            const attrs =
              (c.disabled ? ` aria-disabled="true"` : "") +
              (c.value === current ? ` aria-current="true"` : "") +
              (c.title ? ` title="${esc(c.title)}"` : "");
            const hint = c.hint ? `<span class="combohint">${esc(c.hint)}</span>` : "";
            return `<li role="option" id="${id}" data-value="${esc(c.value)}" aria-selected="false"${attrs}><span>${marked(labelOf(c), text)}</span>${hint}</li>`;
          })
          .join("");
        return `<ul role="group" aria-labelledby="${head}"><li role="presentation" class="combogroup" id="${head}">${esc(g.label)}</li>${options}</ul>`;
      })
      .join("");
    this.shown = [...this.list.querySelectorAll<HTMLElement>('[role="option"]')];
    this.list.hidden = false;
    this.input.setAttribute("aria-expanded", "true");
    // The option the keys had reached stays reached while it is still listed.
    this.active = -1;
    const again = was === undefined ? -1 : this.shown.findIndex((o) => o.dataset["value"] === was);
    this.setActive(again, false);
  }

  private setActive(i: number, scroll: boolean): void {
    this.shown[this.active]?.setAttribute("aria-selected", "false");
    this.active = i;
    const option = this.shown[i];
    if (!option) {
      this.input.removeAttribute("aria-activedescendant");
      return;
    }
    option.setAttribute("aria-selected", "true");
    this.input.setAttribute("aria-activedescendant", option.id);
    if (scroll) option.scrollIntoView({ block: "nearest" });
  }

  /** The next pickable option after the active one, going round. */
  private move(step: 1 | -1): void {
    const n = this.shown.length;
    let i = this.active;
    for (let tries = 0; tries < n; tries += 1) {
      i = i < 0 ? (step > 0 ? 0 : n - 1) : (i + step + n) % n;
      if (!disabled(this.shown[i])) {
        this.setActive(i, true);
        return;
      }
    }
  }

  private take(option: HTMLElement): void {
    if (disabled(option)) return;
    const value = option.dataset["value"] ?? "";
    this.input.value = this.o.keep ? value : "";
    // The field holds a pick now rather than typed text, so the list opens on every choice again.
    this.narrowing = false;
    this.close();
    this.o.pick(value);
    this.refresh();
  }

  private key(e: KeyboardEvent): void {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!this.isOpen()) this.open(this.narrowing);
      this.move(e.key === "ArrowDown" ? 1 : -1);
    } else if (e.key === "Enter" && this.isOpen()) {
      e.preventDefault();
      const option = this.shown[this.active];
      if (option) this.take(option);
      else this.close();
    } else if (e.key === "Escape" && this.isOpen()) {
      e.preventDefault();
      this.close();
    } else if (e.key === "Tab") {
      this.close();
    }
  }
}

const disabled = (option: HTMLElement | null | undefined): boolean => option?.getAttribute("aria-disabled") === "true";
