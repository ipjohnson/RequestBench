// The rows a test's numbers are compared against, and what the popup on each says.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { deltaFor, type Chain } from "../src/lib/delta.ts";
import type { Framework, Route } from "../src/lib/types.ts";
import { baseCell, basePop, cmpCell, peerPop, unfinished } from "../src/lib/views.ts";

const routes: Record<string, Route> = {
  "json.small": { m: "GET", p: "/json/small" },
  "json.large": { m: "GET", p: "/json/large", b: "json.small", v: "size" },
  "compressed.gzip_large": { m: "GET", p: "/compressed/large", b: "json.large", v: "compression" },
};

const factors = { size: "a larger response body", compression: "the middleware <compressing>" };

const framework = (values: Record<string, number>): Framework => ({
  id: "dotnet:carter",
  language: "dotnet",
  name: "carter",
  rungs: {},
  families: {},
  tests: Object.fromEntries(Object.entries(values).map(([id, v]) => [id, { rungs: { regular: { p99Us: v, count: 10 } } }])),
});

const chainAt = (values: Record<string, number>, id: string): Chain => {
  const chain = deltaFor(framework(values), id, "regular", routes, "p99Us");
  if (!chain) throw new Error(`no chain for ${id}`);
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
    assert.deepEqual(lines(basePop(chain, "us", factors, "p99")), [
      "+800 us vs json.small at p99",
      "compression +500 us",
      "the middleware <compressing>",
      "size +300 us",
      "a larger response body",
    ]);
  });

  test("one step is the whole difference, so it carries no share of its own", () => {
    const chain = chainAt({ "json.small": 100, "json.large": 400 }, "json.large");
    assert.deepEqual(lines(basePop(chain, "us", factors, "p99")), ["+300 us vs json.small at p99", "size", "a larger response body"]);
  });

  test("a smaller number carries a minus", () => {
    const chain = chainAt({ "json.small": 400, "json.large": 100 }, "json.large");
    assert.ok(basePop(chain, "us", factors, "p99").includes('<b class="down">−300 us</b> vs json.small'));
  });

  test("a difference inside the histogram's grid says so", () => {
    const chain = chainAt({ "json.small": 100, "json.large": 101 }, "json.large");
    assert.ok(basePop(chain, "us", factors, "p99").includes("so no measurable time"));
  });

  test("escapes what the corpus says a factor reads as", () => {
    const chain = chainAt({ "json.small": 100, "json.large": 400, "compressed.gzip_large": 900 }, "compressed.gzip_large");
    assert.ok(basePop(chain, "us", factors, "p99").includes("the middleware &lt;compressing&gt;"));
  });
});

describe("baseCell", () => {
  test("shows the base's number, hidden, with its popup in a template", () => {
    const cell = baseCell("100 us", chainAt({ "json.small": 100, "json.large": 400 }, "json.large"), "us", factors, "p99");
    assert.match(cell, /^<span class="fb" data-cmp="base" tabindex="0" hidden>100 us<template>.+<\/template><\/span>$/);
  });

  test("a number with nothing to compare is shown without a popup or a tab stop", () => {
    assert.equal(baseCell("5,327", null, "", factors, ""), '<span class="fb" data-cmp="base" hidden>5,327</span>');
  });
});

describe("peerPop", () => {
  test("says how far this framework's number is from the other's", () => {
    assert.deepEqual(lines(peerPop(900, 400, "us", "fastify", "p99")), ["+500 us vs fastify at p99"]);
    assert.ok(peerPop(400, 900, "us", "fastify", "p99").includes('<b class="down">−500 us</b> vs fastify'));
  });

  test("a difference inside the histogram's grid says so", () => {
    assert.deepEqual(lines(peerPop(101, 100, "us", "fastify", "p50")), [
      "+1 us vs fastify at p50",
      "Inside the 4 us the histogram can resolve at this magnitude, so no measurable time.",
    ]);
  });

  test("a byte count is exact, so any difference is one", () => {
    assert.deepEqual(lines(peerPop(29, 27, "B", "fastify", "")), ["+2 B vs fastify"]);
    assert.ok(peerPop(27, 27, "B", "fastify", "").includes('<b class="flat">±0 B</b>'));
  });

  test("escapes the name", () => {
    assert.ok(peerPop(2, 1, "B", "a<b>", "").includes("vs a&lt;b&gt;"));
  });
});

describe("cmpCell", () => {
  test("says what it belongs to, and why it is empty when it is", () => {
    assert.equal(
      cmpCell("node-fastify", "—", null, "fastify could not sustain 5,000 rps."),
      '<span class="fb" data-cmp="node-fastify" title="fastify could not sustain 5,000 rps." hidden>—</span>',
    );
  });

  test("a number with a difference to show carries it in a template and takes a tab stop", () => {
    assert.match(
      cmpCell("node-fastify", "400 us", peerPop(900, 400, "us", "fastify", "p99")),
      /^<span class="fb" data-cmp="node-fastify" tabindex="0" hidden>400 us<template><p class="bphead">.+<\/template><\/span>$/,
    );
  });
});

describe("unfinished", () => {
  test("says what a framework achieved and dropped at a rate it did not complete", () => {
    assert.equal(
      unfinished("carter", { completed: false, rps: 2500, achievedRps: 2292, dropped: 12490 }),
      "carter could not sustain 2,500 rps. It achieved 2,292 rps and dropped 12,490 requests, " +
        "so there are no latencies at this rate.",
    );
  });

  test("a rate it completed, or one no summary said anything about, needs no reason", () => {
    assert.equal(unfinished("carter", { completed: true }), null);
    assert.equal(unfinished("carter", undefined), null);
  });
});
