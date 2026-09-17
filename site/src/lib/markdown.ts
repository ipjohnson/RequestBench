// The bundle's README, as much of Markdown as these files actually use.
//
// Headings, paragraphs, lists and fenced code. The gate in validate.yml is what keeps the
// files to that subset, so a renderer that handles the subset is the whole requirement, and
// what it does not handle is what the gate rejects rather than what a reader sees mangled.
import { esc } from "./html.js";

const inline = (s: string): string =>
  esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

export function md(text: string): string {
  let lines = text.split(/\r?\n/);
  // The page already carries the framework's name as its heading, so a README that opens
  // with one would print it twice.
  if (lines[0]?.startsWith("# ")) lines = lines.slice(1);

  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line.startsWith("```")) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !(lines[i] ?? "").startsWith("```")) {
        body.push(lines[i] ?? "");
        i += 1;
      }
      out.push(`<pre class='code'>${esc(body.join("\n"))}</pre>`);
    } else if (line.startsWith("#")) {
      const depth = Math.min(line.length - line.replace(/^#+/, "").length + 1, 4);
      out.push(`<h${depth}>${inline(line.replace(/^#+\s*/, ""))}</h${depth}>`);
    } else if (/^\s*[-*] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*] /.test(lines[i] ?? "")) {
        items.push(`<li>${inline((lines[i] ?? "").trim().slice(2))}</li>`);
        i += 1;
      }
      out.push(`<ul>${items.join("")}</ul>`);
      continue;
    } else if (line.trim()) {
      const para: string[] = [];
      while (
        i < lines.length &&
        (lines[i] ?? "").trim() &&
        !(lines[i] ?? "").startsWith("#") &&
        !(lines[i] ?? "").startsWith("```")
      ) {
        para.push((lines[i] ?? "").trim());
        i += 1;
      }
      out.push(`<p>${inline(para.join(" "))}</p>`);
      continue;
    }
    i += 1;
  }
  return out.join("\n");
}
