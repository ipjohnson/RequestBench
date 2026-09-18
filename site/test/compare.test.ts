// What a framework page is compared with: the picks, the query that carries them, and the
// numbers another framework is read from.
import { describe, expect, test } from "vitest";
import {
  addPick,
  BASE,
  dropPick,
  endpointAt,
  familyAt,
  MAX,
  readVs,
  statOf,
  targetOf,
  writeVs,
  type Pick,
} from "../src/client/compare.js";
import type { Run, Target } from "../src/lib/types.js";

const known = new Set([BASE, "go-echo", "go-chi", "rust-axum", "rust-warp", "node-hono", "java-javalin"]);
const ids = (picks: Pick[]): string[] => picks.map((x) => x.id);

describe("readVs", () => {
  test("a page opens on the base alone", () => {
    expect(readVs("", known)).toEqual([{ id: BASE, slot: 1 }]);
    expect(readVs("?host=container&rung=1", known)).toEqual([{ id: BASE, slot: 1 }]);
  });

  test("a page with no base to offer opens on nothing", () => {
    expect(readVs("", new Set(["go-echo"]))).toEqual([]);
  });

  test("reads the picks in the order they were made", () => {
    expect(readVs("?vs=go-echo&vs=base&vs=rust-axum", known)).toEqual([
      { id: "go-echo", slot: 1 },
      { id: BASE, slot: 2 },
      { id: "rust-axum", slot: 3 },
    ]);
  });

  test("an empty one is nothing, which is what removing the base leaves", () => {
    expect(readVs("?vs=", known)).toEqual([]);
  });

  test("drops what this page does not offer, a repeat and anything past the limit", () => {
    expect(ids(readVs("?vs=go-gin&vs=go-echo&vs=go-echo", known))).toEqual(["go-echo"]);
    const many = [...known].map((id) => `vs=${id}`).join("&");
    expect(readVs(`?${many}`, known)).toHaveLength(MAX);
  });
});

describe("writeVs", () => {
  test("the default writes nothing, and leaves the rest of the query alone", () => {
    expect(writeVs("?host=container&rung=1", [{ id: BASE, slot: 1 }])).toBe("?host=container&rung=1");
    expect(writeVs("?vs=go-echo", [{ id: BASE, slot: 1 }])).toBe("");
  });

  test("nothing is written as an empty one, so it survives a reload", () => {
    expect(writeVs("", [])).toBe("?vs=");
    expect(readVs(writeVs("", []), known)).toEqual([]);
  });

  test("round-trips the picks in their order", () => {
    const picks = [
      { id: "rust-axum", slot: 1 },
      { id: BASE, slot: 2 },
    ];
    const q = writeVs("?host=container", picks);
    expect(q).toBe("?host=container&vs=rust-axum&vs=base");
    expect(readVs(q, known)).toEqual(picks);
  });
});

describe("addPick and dropPick", () => {
  test("a new pick goes last, in the lowest colour free", () => {
    let picks = readVs("", known);
    picks = addPick(picks, "go-echo");
    picks = addPick(picks, "rust-axum");
    picks = dropPick(picks, "go-echo");
    picks = addPick(picks, "go-chi");
    expect(picks).toEqual([
      { id: BASE, slot: 1 },
      { id: "rust-axum", slot: 3 },
      { id: "go-chi", slot: 2 },
    ]);
  });

  test("removing one leaves the others' colours where they were", () => {
    const picks = addPick(addPick(readVs("", known), "go-echo"), "rust-axum");
    expect(dropPick(picks, BASE)).toEqual([
      { id: "go-echo", slot: 2 },
      { id: "rust-axum", slot: 3 },
    ]);
  });

  test("a repeat and a sixth change nothing", () => {
    const five = ["go-echo", "go-chi", "rust-axum", "rust-warp"].reduce(addPick, readVs("", known));
    expect(five).toHaveLength(MAX);
    expect(addPick(five, "node-hono")).toEqual(five);
    expect(addPick(five, "go-echo")).toEqual(five);
  });
});

const peer: Target = {
  language: "go",
  target: "echo",
  rungs: {
    "1": { completed: true, offered_rps: 500 },
    "2": { completed: false, offered_rps: 2500, achieved_rps: 2100, dropped: 900 },
  },
  endpoints: {
    "json.small": {
      family: "json",
      rungs: { "1": { p50_us: 210, count: 1195 }, "2": { p50_us: 99_000, count: 20 } },
    },
  },
  families_by_rung: {
    "1": { json: { p50_us: 230, count: 3654 } },
    "2": { json: { p50_us: 168_905, count: 18_630 } },
  },
};
const run: Run = { run_id: "r", rungs: [1, 2], targets: [peer] };

describe("another framework's numbers", () => {
  test("are found by the name of its framework page", () => {
    expect(targetOf(run, "go-echo")).toBe(peer);
    expect(targetOf(run, "go-gin")).toBeUndefined();
  });

  test("are its endpoint's and its family's at the rate", () => {
    expect(statOf(endpointAt(peer, "json.small", "1"), "p50_us")).toBe(210);
    expect(statOf(familyAt(peer, "json", "1"), "count")).toBe(3654);
  });

  test("are not read at a rate it did not complete, even where the summary carries them", () => {
    expect(endpointAt(peer, "json.small", "2")).toBeUndefined();
    expect(familyAt(peer, "json", "2")).toBeUndefined();
  });

  test("a statistic it did not publish is no number rather than zero", () => {
    expect(statOf(endpointAt(peer, "json.small", "1"), "p999_us")).toBeNull();
    expect(statOf(endpointAt(peer, "json.large", "1"), "p50_us")).toBeNull();
  });
});
