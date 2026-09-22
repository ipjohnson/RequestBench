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
