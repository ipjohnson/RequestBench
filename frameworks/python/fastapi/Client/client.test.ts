// Hey API's client in HeyApi/, generated from the document FastAPI writes, calling the
// Implementation under uvicorn. These hold the client to what FastAPI answers. The pytest suite in
// UnitTests/ holds FastAPI to the corpus.
import assert from "node:assert/strict";
import { type ChildProcess, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";

import { client } from "./HeyApi/client.gen.ts";
import { oneQueryOneGet, readItemsIdGet, smallJsonSmallGet, twoParametersOneWithSecondTwoGet, validateSmallBodyValidateSmallPost } from "./HeyApi/index.ts";

const directory = process.env["RB_PAYLOADS"];
if (directory === undefined) throw new Error("RB_PAYLOADS has to name the payload directory");
const payload = (file: string) => JSON.parse(readFileSync(join(directory, file), "utf8"));

/** A port no one holds, found by listening on port 0. */
const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const probe = createServer().listen(0, "127.0.0.1", () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => resolve(port));
    });
    probe.on("error", reject);
  });

let server: ChildProcess;

before(async () => {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  // One uvicorn worker, from the environment the suite runs in.
  server = spawn("uv", ["run", "--locked", "uvicorn", "--app-dir", "Implementation", "main:app", "--port", String(port)], {
    cwd: join(import.meta.dirname, ".."),
    stdio: "ignore",
  });
  for (let tries = 0; ; tries++) {
    const up = await fetch(`${base}/health`).then((r) => r.ok, () => false);
    if (up) break;
    if (tries === 300) throw new Error("uvicorn did not answer /health");
    await sleep(100);
  }
  client.setConfig({ baseUrl: base });
});

after(() => {
  server.kill();
});

test("client: json.small is the payload", async () => {
  const { data } = await smallJsonSmallGet();

  assert.deepEqual(data, payload("items.small.json"));
});

test("client: a row is typed by FastAPI's response model", async () => {
  const { data } = await readItemsIdGet({ path: { id: 17 } });

  assert.equal(data?.id, 17);
});

test("client: a validated order is bound", async () => {
  const { data } = await validateSmallBodyValidateSmallPost({ body: payload("order.small.json") });

  assert.equal(data?.fields, 4);
});

test("client: a rejected order is FastAPI's 422, typed as its HTTPValidationError", async () => {
  const { error, response } = await validateSmallBodyValidateSmallPost({ body: payload("order.invalid.json") });

  assert.equal(response?.status, 422);
  assert.ok((error?.detail?.length ?? 0) > 0);
});

test("client: query and path parameters are typed", async () => {
  const query = await oneQueryOneGet({ query: { page: 417 } });
  const path = await twoParametersOneWithSecondTwoGet({ path: { one: 4821, two: 7390 } });

  assert.deepEqual(query.data?.echo, { page: 417 });
  assert.deepEqual(path.data?.echo, { one: 4821, two: 7390 });
});
