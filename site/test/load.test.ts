// Reading the inputs, including the shapes a build has to refuse and the ones it has to keep.
import { describe, expect, test } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isKeyed, loadExemplars, loadRuns, staleExemplars } from "../src/lib/load.js";

function dir(files: Record<string, unknown>): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "rb-site-"));
  for (const [name, body] of Object.entries(files)) {
    const f = path.join(d, name);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, typeof body === "string" ? body : JSON.stringify(body));
  }
  return d;
}

const keyed = (id: string) => ({
  run_id: id,
  tracked: true,
  rungs: [1],
  endpoint_order: ["json.small"],
  targets: [
    { language: "go", target: "chi", rungs: { "1": { p50_us: 1 } }, endpoints: { "json.small": { family: "json", rungs: {} } } },
  ],
});

describe("isKeyed", () => {
  test("a map of endpoint records is the current shape", () => {
    expect(isKeyed(keyed("a"))).toBe(true);
  });

  test("parallel arrays indexed by endpoint_order are not converted, they are refused", () => {
    expect(isKeyed({ targets: [{ endpoints: { "json.small": [1, 2, 3] } }] })).toBe(false);
  });

  test("a run with no endpoint detail at all is not stale", () => {
    expect(isKeyed({ targets: [{ rungs: {} }] })).toBe(true);
  });
});

describe("loadRuns", () => {
  test("walks the month directories and orders by run id", () => {
    const d = dir({ "2026-08/a.json": keyed("2026-08"), "2026-09/b.json": keyed("2026-09") });
    expect(loadRuns(d).runs.map((r) => r.run_id)).toEqual(["2026-08", "2026-09"]);
  });

  test("keeps the document as written, so what is published is what the run wrote", () => {
    const d = dir({ "a.json": { ...keyed("a"), generator: "wrk2", machine: { isolated: "2-3" } } });
    const raw = loadRuns(d).raw.get("a") as Record<string, unknown>;
    expect(raw["generator"]).toBe("wrk2");
    expect(raw["machine"]).toEqual({ isolated: "2-3" });
  });

  test("an unreadable file is named rather than dropped in silence", () => {
    const d = dir({ "a.json": "{ not json", "b.json": keyed("b") });
    const { runs, rejected } = loadRuns(d);
    expect(runs).toHaveLength(1);
    expect(rejected[0]?.file).toMatch(/a\.json$/);
  });

  test("a field whose type moved is reported with the field", () => {
    const d = dir({ "a.json": { ...keyed("a"), run_id: 7 } });
    expect(loadRuns(d).rejected[0]?.why).toMatch(/run_id/);
  });

  test("a summary older than the keyed shape is counted, not read", () => {
    const d = dir({ "a.json": { run_id: "a", targets: [{ endpoints: { x: [1] } }] } });
    const { runs, stale } = loadRuns(d);
    expect(runs).toEqual([]);
    expect(stale).toBe(1);
  });

  test("a dotfile is not a summary", () => {
    expect(loadRuns(dir({ ".DS_Store.json": "{}" })).rejected).toEqual([]);
  });
});

const capture = (endpoint: string, body = "x") => ({
  framework: "chi",
  version: "v5",
  endpoints: [
    {
      endpoint,
      family: "json",
      request: { method: "GET", path: "/json/small", headers: [["host", "x"]], body: null, body_bytes: 0 },
      response: { status: 200, headers: [["content-type", "application/json"]], header_bytes: 90, body_bytes: body.length, body, framing: "content-length" },
    },
  ],
});

describe("loadExemplars", () => {
  test("keys by the file name, which carries the host", () => {
    const d = dir({ "go-chi@container.json": capture("json.small") });
    expect(Object.keys(loadExemplars(d))).toEqual(["go-chi@container"]);
  });

  test("trims a long body and says it was trimmed", () => {
    const d = dir({ "go-chi@container.json": capture("json.small", "y".repeat(900)) });
    const e = loadExemplars(d)["go-chi@container"]?.endpoints["json.small"];
    expect(e?.sb).toHaveLength(700);
    expect(e?.tr).toBe(true);
    expect(e?.sbz).toBe(900);
  });
});

describe("staleExemplars", () => {
  test("names a capture whose endpoints match nothing any run measured", () => {
    const runs = loadRuns(dir({ "a.json": keyed("a") })).runs;
    const wire = loadExemplars(dir({ "go-chi@container.json": capture("blend-v1.thing") }));
    expect(staleExemplars(runs, wire)).toEqual(["go-chi@container"]);
  });

  test("with no runs to compare against, nothing is stale", () => {
    const wire = loadExemplars(dir({ "go-chi@container.json": capture("anything") }));
    expect(staleExemplars([], wire)).toEqual([]);
  });
});
