// Where the explorer reads results from, which is the one thing that has to keep working when
// the results move out of this repo.
import { beforeEach, describe, expect, test, vi } from "vitest";
import { gzipSync } from "node:zlib";
import { CATALOG_VERSION, type Catalog } from "../src/lib/catalog.js";
import { fetchJson } from "../src/client/fetch-json.js";
import { Data, resolveSource } from "../src/client/source.js";
import type { Boot } from "../src/lib/page-data.js";

const page = "https://ipjohnson.github.io/RequestBench/index.html";

const doc = (meta?: string): Document =>
  ({
    querySelector: (sel: string) =>
      sel === 'meta[name="rb:data"]' && meta ? ({ content: meta } as HTMLMetaElement) : null,
  }) as Document;

const loc = (href: string): Location =>
  ({ href, search: new URL(href).search }) as Location;

describe("resolveSource", () => {
  test("defaults to the data directory beside the page", () => {
    const s = resolveSource(doc(), loc(page));
    expect(s.base.href).toBe("https://ipjohnson.github.io/RequestBench/data/");
    expect(s.remote).toBe(false);
  });

  test("a build can name a results site", () => {
    const s = resolveSource(doc("https://ipjohnson.github.io/RequestBench-results/"), loc(page));
    expect(s.base.href).toBe("https://ipjohnson.github.io/RequestBench-results/");
    expect(s.remote).toBe(true);
  });

  test("?data wins, so the published page can be pointed at another set without a build", () => {
    const s = resolveSource(
      doc("https://ipjohnson.github.io/RequestBench-results/"),
      loc(`${page}?data=https://example.org/nightly/`),
    );
    expect(s.base.href).toBe("https://example.org/nightly/");
  });

  test("a base without a trailing slash still names a directory", () => {
    expect(resolveSource(doc(), loc(`${page}?data=https://example.org/nightly`)).base.href).toBe(
      "https://example.org/nightly/",
    );
  });

  test("a relative base resolves against the page", () => {
    const s = resolveSource(doc("../shared-results/"), loc(page));
    expect(s.base.href).toBe("https://ipjohnson.github.io/shared-results/");
    expect(s.remote).toBe(true);
  });

  test("a base that is this page's own data directory is not remote", () => {
    const s = resolveSource(doc("data/"), loc(page));
    expect(s.remote).toBe(false);
  });

  test("an unparseable base falls through rather than throwing", () => {
    expect(resolveSource(doc("http://"), loc(page)).base.href).toBe(
      "https://ipjohnson.github.io/RequestBench/data/",
    );
  });
});

const catalog = (id: string): Catalog => ({
  version: CATALOG_VERSION,
  generated: "2026-09-16T00:00:00Z",
  runs: [
    {
      id,
      file: `${id}.json.gz`,
      date: "2026-09-16",
      languages: ["go"],
      exec_host: "container",
      suite: "blend-v2",
      epoch: "1",
      tracked: true,
      cpu: "x",
      cores: 4,
    },
  ],
  wire: { "go-chi@container": { framework: "chi", version: "v5", file: "wire/go-chi@container.json.gz" } },
  code: { "go:chi": { file: "code/go-chi.json.gz" } },
});

const run = (id: string) => ({ run_id: id, exec_host: "container", tracked: true, rungs: [1], targets: [] });

describe("Data", () => {
  const served = new Map<string, unknown>();
  beforeEach(() => {
    served.clear();
    vi.stubGlobal("fetch", (url: string | URL) => {
      const body = served.get(String(url));
      if (body === undefined) return Promise.resolve({ ok: false } as Response);
      const bytes = gzipSync(Buffer.from(JSON.stringify(body)));
      return Promise.resolve(
        String(url).endsWith(".gz") ? new Response(bytes) : new Response(JSON.stringify(body)),
      );
    });
  });

  test("a local build paints from what the page carries, with no round trip", async () => {
    const boot: Boot = { catalog: catalog("r1"), runs: [run("r1")] };
    const data = await Data.open(boot, resolveSource(doc(), loc(page)));
    expect(data.loadedRuns("container")).toHaveLength(1);
    expect(data.missing("container")).toBe(false);
  });

  test("a remote base replaces the catalog and the runs that came with it", async () => {
    served.set("https://example.org/nightly/catalog.json", catalog("r2"));
    const boot: Boot = { catalog: catalog("r1"), runs: [run("r1")] };
    const data = await Data.open(boot, resolveSource(doc(), loc(`${page}?data=https://example.org/nightly/`)));
    expect(data.manifest.map((m) => m.id)).toEqual(["r2"]);
    expect(data.loadedRuns("container")).toEqual([]);
    expect(data.missing("container")).toBe(true);
  });

  test("documents are addressed against the catalog, so the whole set can move", async () => {
    served.set("https://example.org/nightly/catalog.json", catalog("r2"));
    served.set("https://example.org/nightly/r2.json.gz", run("r2"));
    served.set("https://example.org/nightly/wire/go-chi@container.json.gz", { endpoints: {} });
    const data = await Data.open(
      { catalog: catalog("r1"), runs: [] },
      resolveSource(doc(), loc(`${page}?data=https://example.org/nightly/`)),
    );
    expect(await data.fetchHost("container")).toBe(true);
    expect(data.loadedRuns("container").map((r) => r.run_id)).toEqual(["r2"]);
    expect(await data.fetchWire("go-chi@container")).not.toBeNull();
  });

  test("a base with no catalog is an error the page can report rather than a blank table", async () => {
    await expect(
      Data.open({ catalog: catalog("r1"), runs: [] }, resolveSource(doc(), loc(`${page}?data=https://example.org/gone/`))),
    ).rejects.toThrow(/no catalog at https:\/\/example\.org\/gone\/catalog\.json/);
  });

  test("a shell built with no summaries of its own fetches everything", async () => {
    served.set("https://ipjohnson.github.io/RequestBench/data/catalog.json", catalog("r3"));
    const empty: Catalog = { version: CATALOG_VERSION, generated: "", runs: [], wire: {}, code: {} };
    const data = await Data.open({ catalog: empty, runs: [] }, resolveSource(doc(), loc(page)));
    expect(data.manifest.map((m) => m.id)).toEqual(["r3"]);
  });

  test("one fetch per document, however many callers ask", async () => {
    served.set("https://example.org/nightly/catalog.json", catalog("r2"));
    served.set("https://example.org/nightly/r2.json.gz", run("r2"));
    const data = await Data.open(
      { catalog: catalog("r1"), runs: [] },
      resolveSource(doc(), loc(`${page}?data=https://example.org/nightly/`)),
    );
    const spy = vi.spyOn(globalThis, "fetch");
    await Promise.all([data.fetchHost("container"), data.fetchHost("container")]);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("fetchJson", () => {
  test("unwraps a .gz, which Pages serves as bytes with no Content-Encoding", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(new Response(gzipSync(Buffer.from(JSON.stringify({ a: 1 }))))),
    );
    expect(await fetchJson("https://example.org/x.json.gz")).toEqual({ a: 1 });
  });

  test("a missing document is null rather than a throw", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve({ ok: false } as Response));
    expect(await fetchJson("https://example.org/x.json")).toBeNull();
  });
});
