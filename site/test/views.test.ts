// The base's row on an endpoint's pane, and what the popup on each of its numbers says.
import { describe, expect, test } from "vitest";
import { deltaFor, type Chain } from "../src/lib/delta.js";
import type { Route, Target } from "../src/lib/types.js";
import { baseCell, basePop } from "../src/lib/views.js";

const routes: Record<string, Route> = {
  "json.small": { m: "GET", p: "/json/small" },
  "json.large": { m: "GET", p: "/json/large", b: "json.small", v: "size" },
  "compressed.gzip_large": { m: "GET", p: "/compressed/large", b: "json.large", v: "compression" },
};

const factors = { size: "a larger response body", compression: "the middleware <compressing>" };

const target = (values: Record<string, number>): Target => ({
  language: "go",
  target: "gin",
  rungs: {},
  endpoints: Object.fromEntries(
    Object.entries(values).map(([eid, v]) => [eid, { rungs: { "1": { p99_us: v, count: 10 } } }]),
  ),
});

const chainAt = (values: Record<string, number>, eid: string): Chain => {
  const chain = deltaFor(target(values), eid, "1", routes, "p99_us");
  if (!chain) throw new Error(`no chain for ${eid}`);
  return chain;
};

/** The popup as a reader sees it: its text, one line per paragraph. */
const lines = (html: string): string[] =>
  html
    .split(/<\/p>/)
    .map((s) => s.replace(/<[^>]+>/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim())
    .filter(Boolean);

describe("basePop", () => {
  test("says the difference, then every factor between the two with its share", () => {
    const chain = chainAt({ "json.small": 100, "json.large": 400, "compressed.gzip_large": 900 }, "compressed.gzip_large");
    expect(lines(basePop(chain, "us", factors, "p99"))).toEqual([
      "+800 us vs json.small at p99",
      "compression +500 us",
      "the middleware <compressing>",
      "size +300 us",
      "a larger response body",
    ]);
  });

  test("one step is the whole difference, so it carries no share of its own", () => {
    const chain = chainAt({ "json.small": 100, "json.large": 400 }, "json.large");
    expect(lines(basePop(chain, "us", factors, "p99"))).toEqual([
      "+300 us vs json.small at p99",
      "size",
      "a larger response body",
    ]);
  });

  test("a smaller number carries a minus", () => {
    const chain = chainAt({ "json.small": 400, "json.large": 100 }, "json.large");
    expect(basePop(chain, "us", factors, "p99")).toContain('<b class="down">−300 us</b> vs json.small');
  });

  test("a difference inside the histogram's grid says so", () => {
    const chain = chainAt({ "json.small": 100, "json.large": 101 }, "json.large");
    expect(basePop(chain, "us", factors, "p99")).toContain("so no measurable time");
  });

  test("escapes what the spec says a factor reads as", () => {
    const chain = chainAt({ "json.small": 100, "json.large": 400, "compressed.gzip_large": 900 }, "compressed.gzip_large");
    expect(basePop(chain, "us", factors, "p99")).toContain("the middleware &lt;compressing&gt;");
  });
});

describe("baseCell", () => {
  test("shows the base's number, hidden, with its popup in a template", () => {
    const cell = baseCell("100 us", chainAt({ "json.small": 100, "json.large": 400 }, "json.large"), "us", factors, "p99");
    expect(cell).toMatch(/^<span class="fb" tabindex="0" hidden>100 us<template>.+<\/template><\/span>$/);
  });

  test("a number with nothing to compare is shown without a popup or a tab stop", () => {
    expect(baseCell("5,327", null, "", factors, "")).toBe('<span class="fb" hidden>5,327</span>');
  });
});
