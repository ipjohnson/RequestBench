// What a framework page is compared with: the picks, the query that carries them, and the
// numbers another framework is read from.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  addPick,
  BASE,
  dropPick,
  familyAt,
  frameworkOf,
  MAX,
  readVs,
  statOf,
  testAt,
  writeVs,
  type Pick,
} from "../src/client/compare.ts";
import type { Framework, Run } from "../src/lib/types.ts";

const known = new Set([BASE, "go-echo", "go-chi", "rust-axum", "rust-warp", "node-hono", "java-javalin"]);
const ids = (picks: Pick[]): string[] => picks.map((x) => x.id);

describe("readVs", () => {
  test("a page opens on the base alone", () => {
    assert.deepEqual(readVs("", known), [{ id: BASE, slot: 1 }]);
    assert.deepEqual(readVs("?host=container-h1&rung=regular", known), [{ id: BASE, slot: 1 }]);
  });

  test("a page with no base to offer opens on nothing", () => {
    assert.deepEqual(readVs("", new Set(["go-echo"])), []);
  });

  test("reads the picks in the order they were made", () => {
    assert.deepEqual(readVs("?vs=go-echo&vs=base&vs=rust-axum", known), [
      { id: "go-echo", slot: 1 },
      { id: BASE, slot: 2 },
      { id: "rust-axum", slot: 3 },
    ]);
  });

  test("an empty one is nothing, which is what removing the base leaves", () => {
    assert.deepEqual(readVs("?vs=", known), []);
  });

  test("drops what this page does not offer, a repeat and anything past the limit", () => {
    assert.deepEqual(ids(readVs("?vs=go-gin&vs=go-echo&vs=go-echo", known)), ["go-echo"]);
    const many = [...known].map((id) => `vs=${id}`).join("&");
    assert.equal(readVs(`?${many}`, known).length, MAX);
  });
});

describe("writeVs", () => {
  test("the default writes nothing, and leaves the rest of the query alone", () => {
    assert.equal(writeVs("?host=container-h1&rung=regular", [{ id: BASE, slot: 1 }]), "?host=container-h1&rung=regular");
    assert.equal(writeVs("?vs=go-echo", [{ id: BASE, slot: 1 }]), "");
  });

  test("nothing is written as an empty one, so it survives a reload", () => {
    assert.equal(writeVs("", []), "?vs=");
    assert.deepEqual(readVs(writeVs("", []), known), []);
  });

  test("round-trips the picks in their order", () => {
    const picks = [
      { id: "rust-axum", slot: 1 },
      { id: BASE, slot: 2 },
    ];
    const q = writeVs("?host=container-h1", picks);
    assert.equal(q, "?host=container-h1&vs=rust-axum&vs=base");
    assert.deepEqual(readVs(q, known), picks);
  });
});

describe("addPick and dropPick", () => {
  test("a new pick goes last, in the lowest colour free", () => {
    let picks = readVs("", known);
    picks = addPick(picks, "go-echo");
    picks = addPick(picks, "rust-axum");
    picks = dropPick(picks, "go-echo");
    picks = addPick(picks, "go-chi");
    assert.deepEqual(picks, [
      { id: BASE, slot: 1 },
      { id: "rust-axum", slot: 3 },
      { id: "go-chi", slot: 2 },
    ]);
  });

  test("removing one leaves the others' colours where they were", () => {
    const picks = addPick(addPick(readVs("", known), "go-echo"), "rust-axum");
    assert.deepEqual(dropPick(picks, BASE), [
      { id: "go-echo", slot: 2 },
      { id: "rust-axum", slot: 3 },
    ]);
  });

  test("a repeat and a sixth change nothing", () => {
    const five = ["go-echo", "go-chi", "rust-axum", "rust-warp"].reduce(addPick, readVs("", known));
    assert.equal(five.length, MAX);
    assert.deepEqual(addPick(five, "node-hono"), five);
    assert.deepEqual(addPick(five, "go-echo"), five);
  });
});

const peer: Framework = {
  id: "go:echo",
  language: "go",
  name: "echo",
  rungs: {
    regular: { completed: true, rps: 500 },
    raised: { completed: false, rps: 2500, achievedRps: 2100, dropped: 900 },
  },
  tests: {
    "json.small": { family: "json", rungs: { regular: { p50Us: 210, count: 1195 }, raised: { p50Us: 99_000, count: 20 } } },
  },
  families: {
    regular: { json: { p50Us: 230, count: 3654 } },
    raised: { json: { p50Us: 168_905, count: 18_630 } },
  },
};
const run: Run = { runId: "r", frameworks: [peer] };

describe("another framework's numbers", () => {
  test("are found by the name of its framework page", () => {
    assert.equal(frameworkOf(run, "go-echo"), peer);
    assert.equal(frameworkOf(run, "go-gin"), undefined);
  });

  test("are its test's and its family's at the rate", () => {
    assert.equal(statOf(testAt(peer, "json.small", "regular"), "p50Us"), 210);
    assert.equal(statOf(familyAt(peer, "json", "regular"), "count"), 3654);
  });

  test("are not read at a rate it did not complete, even where the summary carries them", () => {
    assert.equal(testAt(peer, "json.small", "raised"), undefined);
    assert.equal(familyAt(peer, "json", "raised"), undefined);
  });

  test("a statistic it did not publish is no number rather than zero", () => {
    assert.equal(statOf(testAt(peer, "json.small", "regular"), "p999Us"), null);
    assert.equal(statOf(testAt(peer, "json.large", "regular"), "p50Us"), null);
  });
});
