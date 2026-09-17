// The README subset, and the palette the CSS and the charts have to agree on.
import { describe, expect, test } from "vitest";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { md } from "../src/lib/markdown.js";
import { esc, jsonScript } from "../src/lib/html.js";
import { SERIES_DARK, SERIES_LIGHT } from "../src/lib/series.js";

describe("md", () => {
  test("drops a leading h1, which the page already carries as its heading", () => {
    expect(md("# chi\n\nHello.")).toBe("<p>Hello.</p>");
  });

  test("a paragraph joins its lines", () => {
    expect(md("one\ntwo")).toBe("<p>one two</p>");
  });

  test("headings shift down one, so the README nests under the page title", () => {
    expect(md("## Wiring")).toBe("<h3>Wiring</h3>");
  });

  test("a fenced block is code and is not interpreted", () => {
    expect(md("```\n**not bold**\n```")).toBe("<pre class='code'>**not bold**</pre>");
  });

  test("lists take either bullet", () => {
    expect(md("- a\n* b")).toBe("<ul><li>a</li><li>b</li></ul>");
  });

  test("inline code and bold, and nothing else", () => {
    expect(md("`x` and **y** and _z_")).toBe("<p><code>x</code> and <strong>y</strong> and _z_</p>");
  });

  test("a README cannot write markup into the page", () => {
    expect(md("<img src=x onerror=alert(1)>")).toBe(
      "<p>&lt;img src=x onerror=alert(1)&gt;</p>",
    );
  });
});

describe("esc", () => {
  test("covers the attribute delimiters as well as the tag ones", () => {
    expect(esc(`<a href="x" id='y'>&`)).toBe("&lt;a href=&quot;x&quot; id=&#39;y&#39;&gt;&amp;");
  });
});

describe("jsonScript", () => {
  test("a document containing a closing script tag cannot end the element", () => {
    const out = jsonScript({ body: "</script><img src=x>" });
    expect(out).not.toContain("</script");
    expect(JSON.parse(out)).toEqual({ body: "</script><img src=x>" });
  });
});

describe("the palette", () => {
  test("series.ts and tokens.css name the same six hues", () => {
    const css = fs.readFileSync(
      fileURLToPath(new URL("../src/styles/tokens.css", import.meta.url)),
      "utf8",
    );
    const at = (block: string): string[] =>
      [...block.matchAll(/--s(\d): (#[0-9A-Fa-f]{6});/g)].map((m) => m[2] as string);
    const blocks = css.split(/@media|:root\[data-theme="dark"\]/);
    expect(at(blocks[0] as string)).toEqual(SERIES_LIGHT);
    expect(at(blocks[1] as string)).toEqual(SERIES_DARK);
  });
});
