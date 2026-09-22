// Reading the inputs, including the files a build has to refuse and the ones it has to keep.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";
import { loadExemplars, loadRuns, staleExemplars } from "../src/lib/load.ts";

function dir(files: Record<string, unknown>): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "rb-site-"));
  for (const [name, body] of Object.entries(files)) {
    const f = path.join(d, name);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, typeof body === "string" ? body : JSON.stringify(body));
  }
  return d;
}

const summary = (id: string) => ({
  runId: id,
  recorded: true,
  frameworks: [
    {
      id: "go:chi",
      language: "go",
      name: "chi",
      rungs: { regular: { p50Us: 1 } },
      tests: { "json.small": { family: "json", rungs: {} } },
      families: {},
    },
  ],
});

describe("loadRuns", () => {
  test("walks the directories under it and orders by run id", () => {
    const d = dir({ "2026-09/b.json": summary("2026-09"), "2026-08/a.json": summary("2026-08") });
    assert.deepEqual(
      loadRuns(d).runs.map((r) => r.runId),
      ["2026-08", "2026-09"],
    );
  });

  test("keeps the document as written, so what is published is what the run wrote", () => {
    const d = dir({ "a.json": { ...summary("a"), generator: "sha256:1", machine: { cpu: "x", isolated: "2-3" } } });
    const raw = loadRuns(d).raw.get("a") as Record<string, unknown>;
    assert.equal(raw["generator"], "sha256:1");
    assert.deepEqual(raw["machine"], { cpu: "x", isolated: "2-3" });
  });

  test("an unreadable file is named rather than dropped in silence", () => {
    const d = dir({ "a.json": "{ not json", "b.json": summary("b") });
    const { runs, rejected } = loadRuns(d);
    assert.equal(runs.length, 1);
    assert.match(rejected[0]?.file ?? "", /a\.json$/);
  });

  test("a field whose type moved is reported with the field", () => {
    const d = dir({ "a.json": { ...summary("a"), runId: 7 } });
    assert.match(loadRuns(d).rejected[0]?.why ?? "", /runId/);
  });

  test("a dotfile is not a summary", () => {
    assert.deepEqual(loadRuns(dir({ ".DS_Store.json": "{}" })).rejected, []);
  });
});

/** An exemplar file as `rb validate --exemplars` writes it. */
const exemplars = (id: string, body = "x") => ({
  framework: "go:chi",
  host: "container-h1",
  tests: {
    [id]: {
      request: { method: "GET", target: "/json/small", headers: [["accept", "application/json"]], bodyBytes: 0 },
      response: {
        status: 200,
        headers: [["content-type", "application/json"]],
        headerBytes: 90,
        framing: "content-length",
        bodyBytes: body.length,
        body,
        truncated: false,
      },
    },
  },
});

describe("loadExemplars", () => {
  test("keys by the file name, which carries the host", () => {
    const d = dir({ "go-chi@container-h1.json": exemplars("json.small") });
    assert.deepEqual(Object.keys(loadExemplars(d)), ["go-chi@container-h1"]);
  });

  test("reads the family off the test id, and the route off the request", () => {
    const e = loadExemplars(dir({ "go-chi@container-h1.json": exemplars("json.small") }))["go-chi@container-h1"]?.tests["json.small"];
    assert.equal(e?.family, "json");
    assert.deepEqual([e?.m, e?.p, e?.s, e?.fr], ["GET", "/json/small", 200, "content-length"]);
  });

  test("trims a long body and says it was trimmed", () => {
    const d = dir({ "go-chi@container-h1.json": exemplars("json.small", "y".repeat(900)) });
    const e = loadExemplars(d)["go-chi@container-h1"]?.tests["json.small"];
    assert.equal(e?.sb.length, 700);
    assert.equal(e?.tr, true);
    assert.equal(e?.sbz, 900);
  });
});

describe("staleExemplars", () => {
  test("names a capture whose tests match nothing any run measured", () => {
    const runs = loadRuns(dir({ "a.json": summary("a") })).runs;
    const wire = loadExemplars(dir({ "go-chi@container-h1.json": exemplars("domain.lookup") }));
    assert.deepEqual(staleExemplars(runs, wire), ["go-chi@container-h1"]);
  });

  test("with no runs to compare against, nothing is stale", () => {
    const wire = loadExemplars(dir({ "go-chi@container-h1.json": exemplars("anything.at_all") }));
    assert.deepEqual(staleExemplars([], wire), []);
  });
});
