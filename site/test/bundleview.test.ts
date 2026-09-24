// The seam to `rb siteview`, and what a page may link once it has the view.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { permalink, pick, siteView, snippetDoc, unlinkedWhy, verdictOf, type FrameworkView } from "../src/lib/bundleview.ts";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

describe("siteView", () => {
  test("parses what the orchestrator prints, so the two cannot drift apart unnoticed", () => {
    const { view, why } = siteView(ROOT, "HEAD", "container-h1");
    assert.equal(why, null);
    const small = view?.tests.tests["json.small"];
    assert.deepEqual([small?.method, small?.path, small?.source.path], ["GET", "/json/small", "tests/json/small.ts"]);
    assert.equal(view?.tests.tests["json.large"]?.base, "json.small");
    assert.ok(view?.tests.factors["size"]?.reads);
    const read = view?.tests.tests["items.read"];
    assert.ok(read?.about);
    assert.deepEqual([read?.calls[0]?.target, read?.calls[0]?.status], ["/items/{draw.item}", "200"]);
    assert.deepEqual(view?.tests.tests["etag.match_large"]?.primes.map((p) => p.target), ["/etag/large"]);
  });

  test("a commit history does not hold is said, not guessed at", () => {
    const { view, why } = siteView(ROOT, "0000000000000000000000000000000000000000", "container-h1");
    assert.equal(view, null);
    assert.match(why ?? "", /rb siteview --at 0{40} --host container-h1 failed/);
  });

  test("reads the working tree when asked, and says so", () => {
    const { view, why } = siteView(ROOT, null, "container-h1");
    assert.equal(why, null);
    assert.equal(view?.worktree, true);
    assert.equal(view?.tests.pushed, false);
    assert.equal(view?.tests.tests["json.small"]?.source.path, "tests/json/small.ts");
  });
});

const view = (bundleHash: string, pushed: boolean) => ({ bundle: { bundleHash }, pushed });

describe("verdictOf", () => {
  test("verified when the bundle at the commit is the one the run recorded, linkable when it is also pushed", () => {
    assert.deepEqual(verdictOf(view("sha256:a", true), "sha256:a"), { verified: true, linkable: true });
    assert.deepEqual(verdictOf(view("sha256:a", false), "sha256:a"), { verified: true, linkable: false });
    assert.deepEqual(verdictOf(view("sha256:a", true), "sha256:b"), { verified: false, linkable: false });
  });

  test("no view, or no recorded hash, verifies nothing", () => {
    assert.deepEqual(verdictOf(null, "sha256:a"), { verified: false, linkable: false });
    assert.deepEqual(verdictOf(view("sha256:a", true), undefined), { verified: false, linkable: false });
  });
});

describe("pick", () => {
  const recorded = "sha256:ran";

  test("the commit's files when they are what ran, linked when pushed", () => {
    const got = pick(view(recorded, true), view(recorded, false), recorded);
    assert.equal(got.from, "commit");
    assert.deepEqual(got.verdict, { verified: true, linkable: true });
  });

  test("the working tree's when only it is what ran, never linked, because no commit holds it", () => {
    const tree = view(recorded, false);
    const got = pick(view("sha256:older", true), tree, recorded);
    assert.equal(got.view, tree);
    assert.equal(got.from, "worktree");
    assert.deepEqual(got.verdict, { verified: true, linkable: false });
  });

  test("the working tree's when neither is what ran, marked unverified: a mismatch changes what the page says, not whether it shows code", () => {
    const tree = view("sha256:newer", false);
    const got = pick(view("sha256:older", true), tree, recorded);
    assert.equal(got.view, tree);
    assert.equal(got.from, "worktree");
    assert.deepEqual(got.verdict, { verified: false, linkable: false });
    assert.equal(pick(null, tree, recorded).view, tree);
  });

  test("the commit's, unverified, when there is no working tree to read", () => {
    const atCommit = view("sha256:older", true);
    const got = pick(atCommit, null, recorded);
    assert.equal(got.view, atCommit);
    assert.deepEqual(got.verdict, { verified: false, linkable: false });
  });

  test("nothing only when neither has the bundle at all", () => {
    assert.equal(pick(null, null, recorded).view, null);
  });
});

describe("unlinkedWhy", () => {
  const commit = "3cc1fce0adb974bea89e285c042ef048c1ef3395";

  test("nothing to say when the code links", () => {
    assert.equal(unlinkedWhy({ verified: true, linkable: true }, "ipjohnson/RequestBench", commit, "The tests'"), null);
  });

  test("names whose files did not verify, and at which commit", () => {
    assert.match(unlinkedWhy({ verified: false, linkable: false }, "ipjohnson/RequestBench", commit, "The tests'") ?? "", /^The tests' files at 3cc1fce0adb9 do not hash/);
  });

  test("says the files are the working tree's, and why that means no link", () => {
    assert.equal(
      unlinkedWhy({ verified: true, linkable: false }, "ipjohnson/RequestBench", commit, "The tests'", "worktree"),
      "The tests' files are read from the working tree, which hashes to the bundle this run recorded. No commit holds them, so nothing links to them.",
    );
  });

  test("says a working tree that changed since the run may differ from what ran", () => {
    assert.match(
      unlinkedWhy({ verified: false, linkable: false }, "ipjohnson/RequestBench", commit, "The framework's", "worktree") ?? "",
      /^The framework's files are read from the working tree, which has changed since this run, so they may differ from what ran\./,
    );
  });

  test("says a commit nobody pushed is why, once the files verify", () => {
    assert.equal(
      unlinkedWhy({ verified: true, linkable: false }, "ipjohnson/RequestBench", commit, "The framework's"),
      "No remote branch holds 3cc1fce0adb9, so nothing links to the code.",
    );
  });
});

describe("permalink", () => {
  const at = (...args: [string, number?, number?]) => permalink("ipjohnson/RequestBench", "abc", ...args);

  test("a range, a single line as GitHub writes one, and a whole file", () => {
    assert.equal(at("a.ts", 3, 9), "https://github.com/ipjohnson/RequestBench/blob/abc/a.ts#L3-L9");
    assert.equal(at("a.ts", 30, 30), "https://github.com/ipjohnson/RequestBench/blob/abc/a.ts#L30");
    assert.equal(at("tests/json/small.ts"), "https://github.com/ipjohnson/RequestBench/blob/abc/tests/json/small.ts");
  });
});

describe("snippetDoc", () => {
  const part = (path: string, startLine: number) => ({ path, startLine, endLine: startLine + 2, hash: "sha256:x", how: "derived", text: "t", context: [] });
  const fv: FrameworkView = {
    bundle: { bundleVersion: "bundle-v1", id: "node:demo", commit: "abc", bundleHash: "sha256:b", codeHash: "sha256:c", files: [] },
    snippets: {
      "json.small": { endpoint: "json.small", target: "node:demo", handler: part("app.js", 3), support: [], test: [] },
      "compressed.gzip_small": { endpoint: "compressed.gzip_small", target: "node:demo", handler: null, support: [part("app.js", 12)], test: [] },
    },
    problems: [],
    mechanisms: { json: { builtin: "The handler returns the object." } },
    notes: [],
    pushed: true,
  };

  test("links each part only when the page may link", () => {
    assert.equal(snippetDoc(fv, "ipjohnson/RequestBench", "abc", true)["json.small"]?.u, "https://github.com/ipjohnson/RequestBench/blob/abc/app.js#L3-L5");
    assert.equal(snippetDoc(fv, "ipjohnson/RequestBench", "abc", false)["json.small"]?.u, null);
  });

  test("carries what the family is wired with, and leaves out a test with no handler", () => {
    const doc = snippetDoc(fv, "ipjohnson/RequestBench", "abc", true);
    assert.deepEqual(doc["json.small"]?.w, { m: undefined, d: undefined, b: "The handler returns the object." });
    assert.deepEqual(Object.keys(doc), ["json.small"]);
  });
});
