// Escaping, for the places that build HTML as a string rather than as markup.
//
// Astro escapes an expression on its own, so this is only for what goes through `set:html`
// and for the browser, which renders rows by assigning innerHTML.

export function esc(s: unknown): string {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}

/**
 * A JSON document safe to put inside a <script> element.
 *
 * The parser ends the element at the first `</script`, wherever it appears, so a run whose
 * text contains one would end the script early and put the rest of the document on the page
 * as markup. Escaping `<` costs nothing and a JSON reader unescapes it.
 */
export function jsonScript(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

/**
 * A line of a README's prose as HTML: its code spans, and its links to an absolute URL. A relative
 * link reads as its text, because the page does not sit where the README does.
 */
export function proseHtml(text: string): string {
  return text
    .split(/(`[^`]+`)/)
    .map((part) => (/^`[^`]+`$/.test(part) ? `<code>${esc(part.slice(1, -1))}</code>` : linked(part)))
    .join("");
}

function linked(text: string): string {
  let out = "";
  let at = 0;
  for (const m of text.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)) {
    const [whole, label, href] = m as unknown as [string, string, string];
    out += esc(text.slice(at, m.index)) + (/^https?:\/\//.test(href) ? `<a href="${esc(href)}">${esc(label)}</a>` : esc(label));
    at = m.index! + whole.length;
  }
  return out + esc(text.slice(at));
}
