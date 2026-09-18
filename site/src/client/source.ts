// Where the explorer reads results from.
//
// The page is the generator's; the results are not necessarily. A run is written by whoever
// ran the machine, and the set grows by a run a night, so it wants to live in its own repo
// and be published on its own schedule. Nothing on this page needs rebuilding when it does:
// the documents are addressed through a catalog, and the catalog is addressed through a base
// URL that three things can set, in this order.
//
//   1. `?data=<url>` on the page, which is how you point the published explorer at a results
//      set it was not built against without building anything.
//   2. `<meta name="rb:data">`, written at build time from --data-base, which is how a
//      deployment names its own results set.
//   3. `data/`, the directory this build wrote, which is what happens when neither is set.
//
// A cross-origin base needs that origin to allow the read. GitHub Pages sends
// `Access-Control-Allow-Origin: *`, so a results repo published on Pages works as it stands.
import { Catalog } from "../lib/catalog.js";
import type { Boot } from "../lib/page-data.js";
import type { Run, WireDoc } from "../lib/types.js";
import { fetchJson } from "./fetch-json.js";

export type Source = { base: URL; remote: boolean };

export type CodePart = { f: string; s: number; e: number; h: string; u: string | null; t: string };

// The handler, the support parts the family is wired with, what it declares that wiring is,
// and the contract tests that hold it. Written by snippetDoc; the short keys are because
// this ships beside the run.
export type CodeDoc = Record<
  string,
  CodePart & { sup?: CodePart[]; tst?: CodePart[]; w?: { m?: string; d?: string; b?: string } }
>;

export function resolveSource(doc: Document = document, loc: Location = location): Source {
  const asked = new URLSearchParams(loc.search).get("data");
  const declared = doc.querySelector<HTMLMetaElement>('meta[name="rb:data"]')?.content;
  const here = new URL("data/", loc.href);
  for (const candidate of [asked, declared]) {
    if (!candidate) continue;
    try {
      // A base is a directory, so it ends in a slash: without one the last segment is a file
      // name and `new URL('x', base)` drops it.
      const base = new URL(candidate.endsWith("/") ? candidate : `${candidate}/`, loc.href);
      return { base, remote: base.href !== here.href };
    } catch {
      /* an unparseable base falls through to the next candidate */
    }
  }
  return { base: here, remote: false };
}

/** Everything the explorer fetches, addressed against one base. */
export class Data {
  readonly source: Source;
  catalog: Catalog;

  private readonly runs = new Map<string, Run>();
  private readonly inflight = new Map<string, Promise<unknown>>();
  private readonly wire = new Map<string, WireDoc | null>();
  private readonly code = new Map<string, CodeDoc | null>();

  constructor(source: Source, catalog: Catalog, runs: Run[] = []) {
    this.source = source;
    this.catalog = catalog;
    for (const r of runs) this.runs.set(r.run_id, r);
  }

  /**
   * The bootstrap when it describes this base, the fetched catalog when it does not.
   *
   * A remote base is a different data set, so the embedded runs are dropped with the catalog
   * that listed them rather than left to show up under ids the new catalog never names.
   */
  static async open(boot: Boot, source: Source): Promise<Data> {
    if (!source.remote && boot.catalog.runs.length) {
      return new Data(source, boot.catalog, boot.runs);
    }
    const raw = await fetchJson<unknown>(new URL("catalog.json", source.base)).catch(() => null);
    const parsed = Catalog.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`no catalog at ${new URL("catalog.json", source.base).href}`);
    }
    return new Data(source, parsed.data);
  }

  private url(file: string): URL {
    return new URL(file, this.source.base);
  }

  /** One fetch per document, however many callers ask for it. */
  private once<T>(key: string, run: () => Promise<T>): Promise<T> {
    const started = this.inflight.get(key) as Promise<T> | undefined;
    if (started) return started;
    const p = run();
    this.inflight.set(key, p);
    return p;
  }

  get manifest(): Catalog["runs"] {
    return this.catalog.runs.filter((m) => m.tracked);
  }

  get hosts(): string[] {
    return [...new Set(this.manifest.map((m) => m.exec_host))].sort();
  }

  loadedRuns(host: string): Run[] {
    return this.manifest
      .filter((m) => m.exec_host === host)
      .map((m) => this.runs.get(m.id))
      .filter((r): r is Run => Boolean(r))
      .sort((a, b) => (a.run_id < b.run_id ? -1 : 1));
  }

  missing(host: string): boolean {
    return this.manifest.some((m) => m.exec_host === host && !this.runs.has(m.id));
  }

  /** Every run on a host. Resolves to whether anything new arrived. */
  async fetchHost(host: string): Promise<boolean> {
    const want = this.manifest.filter((m) => m.exec_host === host && !this.runs.has(m.id));
    if (!want.length) return false;
    await Promise.all(
      want.map((m) =>
        this.once(`run:${m.id}`, () =>
          fetchJson<Run>(this.url(m.file))
            .then((run) => {
              if (run) this.runs.set(m.id, run);
            })
            .catch(() => undefined),
        ),
      ),
    );
    return true;
  }

  wireMeta(key: string): { framework: string; version: string } | undefined {
    return this.catalog.wire[key];
  }

  wireDoc(key: string): WireDoc | null | undefined {
    return this.wire.get(key);
  }

  async fetchWire(key: string): Promise<WireDoc | null> {
    if (this.wire.has(key)) return this.wire.get(key) ?? null;
    const meta = this.catalog.wire[key];
    if (!meta) return null;
    return this.once(`wire:${key}`, async () => {
      const doc = await fetchJson<WireDoc>(this.url(meta.file)).catch(() => null);
      this.wire.set(key, doc);
      return doc;
    });
  }

  async fetchCode(key: string): Promise<CodeDoc | null> {
    if (this.code.has(key)) return this.code.get(key) ?? null;
    const meta = this.catalog.code[key];
    if (!meta) return null;
    return this.once(`code:${key}`, async () => {
      const doc = await fetchJson<CodeDoc>(this.url(meta.file)).catch(() => null);
      this.code.set(key, doc);
      return doc;
    });
  }
}
