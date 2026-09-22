// Escaping, and the palette the CSS and the charts have to agree on.
import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { esc, jsonScript } from "../src/lib/html.ts";
import { SERIES_DARK, SERIES_LIGHT } from "../src/lib/series.ts";

describe("esc", () => {
  test("covers the attribute delimiters as well as the tag ones", () => {
    assert.equal(esc(`<a href="x" id='y'>&`), "&lt;a href=&quot;x&quot; id=&#39;y&#39;&gt;&amp;");
  });
});

describe("jsonScript", () => {
  test("a document containing a closing script tag cannot end the element", () => {
    const out = jsonScript({ body: "</script><img src=x>" });
    assert.ok(!out.includes("</script"));
    assert.deepEqual(JSON.parse(out), { body: "</script><img src=x>" });
  });
});

describe("the palette", () => {
  test("series.ts and tokens.css name the same six hues", () => {
    const css = fs.readFileSync(fileURLToPath(new URL("../src/styles/tokens.css", import.meta.url)), "utf8");
    const at = (block: string): string[] => [...block.matchAll(/--s(\d): (#[0-9A-Fa-f]{6});/g)].map((m) => m[2] as string);
    const blocks = css.split(/@media|:root\[data-theme="dark"\]/);
    assert.deepEqual(at(blocks[0] as string), SERIES_LIGHT);
    assert.deepEqual(at(blocks[1] as string), SERIES_DARK);
  });
});
