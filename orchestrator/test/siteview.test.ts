// The site's view of a framework, from a scratch repository whose code the test writes: where
// each test is answered, what rb.json declares, and the README, all at a commit.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

import suite from "@rb/tests";
import { corpusEndpoints, frameworkView, testsView } from "../siteview.ts";
import type { Endpoint } from "../snippets.ts";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const DEMO = { language: "node", name: "demo" };
const DIR = "frameworks/node/demo";

let repo: string;
let head: string;
const git = (...args: string[]) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
const put = (path: string, text: string) => {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), text);
};

const ENDPOINTS: Endpoint[] = [
  { id: "json.small", family: "json", method: "GET", path: "/json/small" },
  { id: "items.read", family: "items", method: "GET", path: "/items/{draw.item}" },
  { id: "errors.not_found", family: "errors", method: "GET", path: "/items/999999", base: "items.read" },
  { id: "compressed.gzip_small", family: "compressed", method: "GET", path: "/compressed/small" },
];
const REQUIRED = new Set(ENDPOINTS.map((e) => e.id));

before(() => {
  repo = mkdtempSync(join(tmpdir(), "rb-siteview-"));
  git("init", "-q");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "t");
  put(
    `${DIR}/rb.json`,
    JSON.stringify({
      framework: "Demo",
      licence: "MIT",
      repo: "https://example.com/demo",
      package: "https://example.com/demo/package",
      lockfile: ["package-lock.json"],
      hosts: { "container-h1": { dockerfile: "Dockerfile" } },
      upgrade: null,
      mechanisms: {
        json: { builtin: "The handler returns the object." },
        items: { builtin: "The route captures the id." },
        errors: { builtin: "The router answers a miss." },
        compressed: { mechanism: "@demo/compress on the compressed routes", dependency: "@demo/compress" },
      },
    }),
  );
  put(`${DIR}/README.md`, "# Demo\n\nWired by hand.\n\n## Notes\n\n- Demo answers HEAD\n  from the GET route.\n");
  put(`${DIR}/Dockerfile`, "FROM node:26\n");
  put(`${DIR}/package-lock.json`, '{ "packages": { "node_modules/@demo/compress": {} } }\n');
  put(
    `${DIR}/app.js`,
    [
      'import compress from "@demo/compress";',
      "",
      'app.get("/json/small", (req, res) => {',
      "  res.send(items.small);",
      "});",
      "",
      'app.get("/items/:id", (req, res) => {',
      "  res.send(rows[req.params.id]);",
      "});",
      "",
      "// rb:wiring compressed.*",
      'app.register(compress, { prefix: "/compressed" });',
      "",
      'app.get("/compressed/small", (req, res) => res.send(items.small));',
      "",
    ].join("\n"),
  );
  git("add", "-A");
  git("commit", "-qm", "demo");
  head = git("rev-parse", "HEAD");
});

after(() => rmSync(repo, { recursive: true, force: true }));

test("each test is located at the commit, and the declaration and README come from the same commit", () => {
  const view = frameworkView(repo, DEMO, head, ENDPOINTS, REQUIRED);
  assert.deepEqual(view.problems, []);
  const small = view.snippets["json.small"]!;
  assert.equal(small.handler!.how, "derived");
  assert.equal(small.handler!.path, `${DIR}/app.js`);
  assert.deepEqual([small.handler!.startLine, small.handler!.endLine], [3, 5]);
  // /items/999999 has no route of its own, and /items/:id is what answers it.
  assert.equal(view.snippets["errors.not_found"]!.handler!.startLine, 7);
  assert.deepEqual(view.snippets["compressed.gzip_small"]!.support.map((p) => [p.how, p.startLine]), [["marker", 12]]);
  assert.equal(view.mechanisms["compressed"] && "dependency" in view.mechanisms["compressed"] ? view.mechanisms["compressed"].dependency : "", "@demo/compress");
  assert.equal(view.readme, "# Demo\n\nWired by hand.\n\n## Notes\n\n- Demo answers HEAD\n  from the GET route.\n");
  assert.deepEqual(view.notes, ["Demo answers HEAD from the GET route."]);
  assert.deepEqual(view.project, { framework: "Demo", licence: "MIT", repo: "https://example.com/demo", package: "https://example.com/demo/package" });
  assert.equal(view.bundle.commit, head);
  assert.equal(view.pushed, false);
});

test("a mechanism rb.json declares and the code does not bear out is a problem", () => {
  put(`${DIR}/app.js`, 'app.get("/json/small", (req, res) => res.send(items.small));\napp.get("/items/:id", (req, res) => res.send(rows[0]));\n');
  git("commit", "-qam", "drop the compression");
  const view = frameworkView(repo, DEMO, git("rev-parse", "HEAD"), ENDPOINTS, REQUIRED);
  assert.ok(view.problems.some((p) => /declares @demo\/compress on the compressed routes for compressed and marks no wiring/.test(p)), view.problems.join("\n"));
  assert.ok(view.problems.some((p) => /locates a handler for only 3\/4/.test(p)), view.problems.join("\n"));
  // The older commit still answers as it did.
  assert.deepEqual(frameworkView(repo, DEMO, head, ENDPOINTS, REQUIRED).problems, []);
});

test("the tests view carries every test's source, its route, its base and the payloads it names", async () => {
  const { recordings } = await corpusEndpoints(suite);
  const view = testsView(ROOT, undefined, suite, recordings);
  assert.equal(Object.keys(view.tests).length, Object.keys(suite.tests).length);
  const large = view.tests["json.large"]!;
  assert.equal(large.source.path, "tests/json/large.ts");
  assert.match(large.source.text, /performanceTest\(/);
  assert.deepEqual([large.method, large.path], ["GET", "/json/large"]);
  assert.equal(view.tests["body.bind_small"]!.method, "POST");
  assert.deepEqual([large.base, large.varies], ["json.small", "size"]);
  assert.deepEqual(large.payloads, ["items.large"]);
  assert.equal(view.pushed, false);
  assert.equal(view.factors["size"]?.reads, "a larger response body, same route and same handler");
  assert.ok(view.families["json"]!.about.length > 0);
});
