// The rows an endpoint's numbers are compared against, and what the popup on each says.
import { describe, expect, test } from "vitest";
import { deltaFor, type Chain } from "../src/lib/delta.js";
import type { Route, Target } from "../src/lib/types.js";
import { baseCell, basePop, cmpCell, peerPop, unfinished } from "../src/lib/views.js";

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
    expect(cell).toMatch(/^<span class="fb" data-cmp="base" tabindex="0" hidden>100 us<template>.+<\/template><\/span>$/);
  });

  test("a number with nothing to compare is shown without a popup or a tab stop", () => {
    expect(baseCell("5,327", null, "", factors, "")).toBe('<span class="fb" data-cmp="base" hidden>5,327</span>');
  });
});

describe("peerPop", () => {
  test("says how far this framework's number is from the other's", () => {
    expect(lines(peerPop(900, 400, "us", "echo", "p99"))).toEqual(["+500 us vs echo at p99"]);
    expect(peerPop(400, 900, "us", "echo", "p99")).toContain('<b class="down">−500 us</b> vs echo');
  });

  test("a difference inside the histogram's grid says so", () => {
    expect(lines(peerPop(101, 100, "us", "echo", "p50"))).toEqual([
      "+1 us vs echo at p50",
      "Inside the 4 us the histogram can resolve at this magnitude, so no measurable time.",
    ]);
  });

  test("a byte count is exact, so any difference is one", () => {
    expect(lines(peerPop(29, 27, "B", "echo", ""))).toEqual(["+2 B vs echo"]);
    expect(peerPop(27, 27, "B", "echo", "")).toContain('<b class="flat">±0 B</b>');
  });

  test("escapes the name", () => {
    expect(peerPop(2, 1, "B", "a<b>", "")).toContain("vs a&lt;b&gt;");
  });
});

describe("cmpCell", () => {
  test("says what it belongs to, and why it is empty when it is", () => {
    expect(cmpCell("go-echo", "—", null, "echo could not sustain 5,000 rps.")).toBe(
      '<span class="fb" data-cmp="go-echo" title="echo could not sustain 5,000 rps." hidden>—</span>',
    );
  });

  test("a number with a difference to show carries it in a template and takes a tab stop", () => {
    expect(cmpCell("go-echo", "400 us", peerPop(900, 400, "us", "echo", "p99"))).toMatch(
      /^<span class="fb" data-cmp="go-echo" tabindex="0" hidden>400 us<template><p class="bphead">.+<\/template><\/span>$/,
    );
  });
});

describe("unfinished", () => {
  test("says what a target achieved and dropped at a rate it did not complete", () => {
    expect(unfinished("gin", { completed: false, offered_rps: 5000, achieved_rps: 4953, dropped: 1239 })).toBe(
      "gin could not sustain 5,000 rps. It achieved 4,953 rps and dropped 1,239 requests, " +
        "so there are no latencies at this rate.",
    );
  });

  test("a rate it completed, or one no summary said anything about, needs no reason", () => {
    expect(unfinished("gin", { completed: true })).toBeNull();
    expect(unfinished("gin", undefined)).toBeNull();
  });
});
