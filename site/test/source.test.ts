// Where the explorer reads results from, which is the one thing that has to keep working when
// the results move out of this repo.
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import { gzipSync } from "node:zlib";
import { CATALOG_VERSION, type Catalog } from "../src/lib/catalog.ts";
import { fetchJson } from "../src/client/fetch-json.ts";
import { Data, resolveSource } from "../src/client/source.ts";
import type { Boot } from "../src/lib/page-data.ts";
import type { Run } from "../src/lib/types.ts";

const page = "https://ipjohnson.github.io/RequestBench/index.html";

const doc = (meta?: string): Document =>
  ({
    querySelector: (sel: string) => (sel === 'meta[name="rb:data"]' && meta ? ({ content: meta } as HTMLMetaElement) : null),
  }) as Document;

const loc = (href: string): Location => ({ href, search: new URL(href).search }) as Location;

describe("resolveSource", () => {
  test("defaults to the data directory beside the page", () => {
    const s = resolveSource(doc(), loc(page));
    assert.equal(s.base.href, "https://ipjohnson.github.io/RequestBench/data/");
    assert.equal(s.remote, false);
  });

  test("a build can name a results site", () => {
    const s = resolveSource(doc("https://ipjohnson.github.io/RequestBench-results/"), loc(page));
    assert.equal(s.base.href, "https://ipjohnson.github.io/RequestBench-results/");
    assert.equal(s.remote, true);
  });

  test("?data wins, so the published page can be pointed at another set without a build", () => {
    const s = resolveSource(doc("https://ipjohnson.github.io/RequestBench-results/"), loc(`${page}?data=https://example.org/nightly/`));
    assert.equal(s.base.href, "https://example.org/nightly/");
  });

  test("a base without a trailing slash still names a directory", () => {
    assert.equal(resolveSource(doc(), loc(`${page}?data=https://example.org/nightly`)).base.href, "https://example.org/nightly/");
  });

  test("a relative base resolves against the page", () => {
    const s = resolveSource(doc("../shared-results/"), loc(page));
    assert.equal(s.base.href, "https://ipjohnson.github.io/shared-results/");
    assert.equal(s.remote, true);
  });

  test("a base that is this page's own data directory is not remote", () => {
    assert.equal(resolveSource(doc("data/"), loc(page)).remote, false);
  });

  test("an unparseable base falls through rather than throwing", () => {
    assert.equal(resolveSource(doc("http://"), loc(page)).base.href, "https://ipjohnson.github.io/RequestBench/data/");
  });
});

const catalog = (id: string): Catalog => ({
  version: CATALOG_VERSION,
  generated: "2026-09-21T00:00:00Z",
  runs: [
    {
      id,
      file: `${id}.json.gz`,
      date: "2026-09-21",
      languages: ["dotnet"],
      host: "container-h1",
      ladder: "ladder-v1",
      corpus: "sha256:e0135cc870db",
      recorded: true,
      cpu: "x",
      cores: 4,
    },
  ],
  wire: { "dotnet-carter@container-h1": { framework: "dotnet:carter", file: "wire/dotnet-carter@container-h1.json.gz" } },
  code: { "dotnet:carter": { file: "code/dotnet-carter.json.gz" } },
});

const run = (id: string): Run => ({ runId: id, host: "container-h1", recorded: true, frameworks: [] });

describe("Data", () => {
  const served = new Map<string, unknown>();
  let fetchMock: ReturnType<typeof mock.method>;
  beforeEach(() => {
    served.clear();
    fetchMock = mock.method(globalThis, "fetch", (url: string | URL) => {
      const body = served.get(String(url));
      if (body === undefined) return Promise.resolve({ ok: false } as Response);
      const bytes = gzipSync(Buffer.from(JSON.stringify(body)));
      return Promise.resolve(String(url).endsWith(".gz") ? new Response(bytes) : new Response(JSON.stringify(body)));
    });
  });
  afterEach(() => mock.restoreAll());

  test("a local build paints from what the page carries, with no round trip", async () => {
    const boot: Boot = { catalog: catalog("r1"), runs: [run("r1")] };
    const data = await Data.open(boot, resolveSource(doc(), loc(page)));
    assert.equal(data.loadedRuns("container-h1").length, 1);
    assert.equal(data.missing("container-h1"), false);
    assert.equal(fetchMock.mock.callCount(), 0);
  });

  test("a remote base replaces the catalog and the runs that came with it", async () => {
    served.set("https://example.org/nightly/catalog.json", catalog("r2"));
    const boot: Boot = { catalog: catalog("r1"), runs: [run("r1")] };
    const data = await Data.open(boot, resolveSource(doc(), loc(`${page}?data=https://example.org/nightly/`)));
    assert.deepEqual(
      data.manifest.map((m) => m.id),
      ["r2"],
    );
    assert.deepEqual(data.loadedRuns("container-h1"), []);
    assert.equal(data.missing("container-h1"), true);
  });

  test("documents are addressed against the catalog, so the whole set can move", async () => {
    served.set("https://example.org/nightly/catalog.json", catalog("r2"));
    served.set("https://example.org/nightly/r2.json.gz", run("r2"));
    served.set("https://example.org/nightly/wire/dotnet-carter@container-h1.json.gz", { tests: {} });
    const data = await Data.open({ catalog: catalog("r1"), runs: [] }, resolveSource(doc(), loc(`${page}?data=https://example.org/nightly/`)));
    assert.equal(await data.fetchHost("container-h1"), true);
    assert.deepEqual(
      data.loadedRuns("container-h1").map((r) => r.runId),
      ["r2"],
    );
    assert.notEqual(await data.fetchWire("dotnet-carter@container-h1"), null);
  });

  test("a base with no catalog is an error the page can report rather than a blank table", async () => {
    await assert.rejects(
      Data.open({ catalog: catalog("r1"), runs: [] }, resolveSource(doc(), loc(`${page}?data=https://example.org/gone/`))),
      /no catalog at https:\/\/example\.org\/gone\/catalog\.json/,
    );
  });

  test("a shell built with no summaries of its own fetches everything", async () => {
    served.set("https://ipjohnson.github.io/RequestBench/data/catalog.json", catalog("r3"));
    const empty: Catalog = { version: CATALOG_VERSION, generated: "", runs: [], wire: {}, code: {} };
    const data = await Data.open({ catalog: empty, runs: [] }, resolveSource(doc(), loc(page)));
    assert.deepEqual(
      data.manifest.map((m) => m.id),
      ["r3"],
    );
  });

  test("one fetch per document, however many callers ask", async () => {
    served.set("https://example.org/nightly/catalog.json", catalog("r2"));
    served.set("https://example.org/nightly/r2.json.gz", run("r2"));
    const data = await Data.open({ catalog: catalog("r1"), runs: [] }, resolveSource(doc(), loc(`${page}?data=https://example.org/nightly/`)));
    const before = fetchMock.mock.callCount();
    await Promise.all([data.fetchHost("container-h1"), data.fetchHost("container-h1")]);
    assert.equal(fetchMock.mock.callCount() - before, 1);
  });
});

describe("fetchJson", () => {
  afterEach(() => mock.restoreAll());

  test("unwraps a .gz, which Pages serves as bytes with no Content-Encoding", async () => {
    mock.method(globalThis, "fetch", () => Promise.resolve(new Response(gzipSync(Buffer.from(JSON.stringify({ a: 1 }))))));
    assert.deepEqual(await fetchJson("https://example.org/x.json.gz"), { a: 1 });
  });

  test("a missing document is null rather than a throw", async () => {
    mock.method(globalThis, "fetch", () => Promise.resolve({ ok: false } as Response));
    assert.equal(await fetchJson("https://example.org/x.json"), null);
  });
});
