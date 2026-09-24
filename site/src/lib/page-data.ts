// What the page carries, as against what it fetches.
//
// The split is by where a thing comes from. Routes, factors, host notes and the framework page
// index are the generator's: they come out of the corpus and this repository's history, they
// are small, and they are the same whichever results the page is pointed at. Runs, wire
// captures and code documents are the results', they grow by a run a night, and they are
// addressed through the catalog so they can live somewhere else entirely.
import type { Catalog } from "./catalog.ts";
import type { HostNote, Route, Run } from "./types.ts";

export type Boot = { catalog: Catalog; runs: Run[] };

export type PageData = {
  boot: Boot;
  hosts: Record<string, HostNote>;
  routes: Record<string, Route>;
  factors: Record<string, string>;
  /** By host, "<language>:<name>" to the framework page for it, when this build wrote one. */
  pages: Record<string, Record<string, string>>;
};
