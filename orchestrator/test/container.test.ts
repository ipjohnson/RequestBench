// container-h1 against a real Docker engine, with busybox's httpd standing in for a framework.
// Needs Docker, so it is `npm run test:docker` rather than part of `npm test`.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import http from "node:http";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, test } from "node:test";

import { build, meta, probe, start, type Address } from "../container.ts";

const FIXTURE = { language: "fixture", name: "httpd" };
const BUSYBOX = "busybox:1.37";

let repo: string;
const git = (...args: string[]) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
const put = (path: string, text: string) => {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), text);
};
const dir = "frameworks/fixture/httpd";

const get = (a: Address, path: string) =>
  new Promise<number>((resolve, reject) => {
    http.get({ host: a.host, port: a.port, path, agent: false }, (res) => (res.resume(), resolve(res.statusCode ?? 0))).on("error", reject);
  });

before(() => {
  repo = mkdtempSync(join(tmpdir(), "rb-container-"));
  git("init", "-q");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "t");
  put(`${dir}/Dockerfile`, `FROM ${BUSYBOX}\nCOPY www /www\nCMD ["httpd", "-f", "-p", "8080", "-h", "/www"]\n`);
  put(`${dir}/Dockerfile.broken`, `FROM ${BUSYBOX}\nCMD ["sh", "-c", "echo cannot bind the port >&2; exit 3"]\n`);
  put(`${dir}/www/health`, "ok\n");
  put(`${dir}/www/__meta`, JSON.stringify({ framework: "httpd", version: "1.37" }));
  put(`${dir}/.gitignore`, "www/bin/\n");
  put("tests/payloads/items.small.json", "{}\n");
  git("add", "-A");
  git("commit", "-qm", "fixture");
  // After the commit: one file only the working tree has, and one git ignores.
  put(`${dir}/www/uncommitted`, "new\n");
  put(`${dir}/www/bin/ignored`, "build output\n");
});

after(() => {
  rmSync(repo, { recursive: true, force: true });
  try {
    execFileSync("docker", ["rmi", "-f", "rb/fixture-httpd:container-h1"], { stdio: "ignore" });
  } catch {
    // nothing to remove
  }
});

test("a working-tree build holds untracked files and never ignored ones, and it boots, answers and stops", async () => {
  const built = await build(repo, FIXTURE, "container-h1", { dockerfile: "Dockerfile" });
  assert.match(built.imageId, /^sha256:[0-9a-f]{64}$/);
  assert.ok(built.imageBytes > 0);
  assert.equal(built.commit, undefined);
  const running = start(repo, built, FIXTURE, "container-h1");
  try {
    const ready = await probe(running.address, 30_000, running.alive);
    assert.ok(ready.readyMs > 0 && ready.probeMs > 0 && ready.probeMs <= ready.readyMs);
    assert.deepEqual(await meta(running.address), { framework: "httpd", version: "1.37" });
    assert.equal(await get(running.address, "/uncommitted"), 200);
    assert.equal(await get(running.address, "/bin/ignored"), 404);
  } finally {
    running.stop();
  }
  assert.equal(running.alive(), false);
});

test("a build at a commit holds exactly that commit's files", async () => {
  const head = git("rev-parse", "HEAD");
  const built = await build(repo, FIXTURE, "container-h1", { dockerfile: "Dockerfile" }, head);
  assert.equal(built.commit, head);
  const running = start(repo, built, FIXTURE, "container-h1");
  try {
    await probe(running.address, 30_000, running.alive);
    assert.equal(await get(running.address, "/health"), 200);
    assert.equal(await get(running.address, "/uncommitted"), 404);
  } finally {
    running.stop();
  }
});

test("a framework that exits is reported as dead, and its log is kept", async () => {
  const built = await build(repo, FIXTURE, "container-h1", { dockerfile: "Dockerfile.broken" });
  const running = start(repo, built, FIXTURE, "container-h1");
  try {
    await assert.rejects(probe(running.address, 30_000, running.alive), /exited before it answered \/health/);
    assert.match(running.logs(), /cannot bind the port/);
  } finally {
    running.stop();
  }
});
