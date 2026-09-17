// What the page carries, as against what it fetches.
//
// The split is by where a thing comes from. Routes, factors, host notes and the framework
// page index are the generator's: they come out of spec/ and out of this repo's history, they
// are small, and they are the same whichever results the page is pointed at. Runs, wire
// captures and handler documents are the results', they grow by a run a night, and they are
// addressed through the catalog so they can live somewhere else entirely.
import type { Catalog } from "./catalog.js";
import type { HostNote, Route, Run } from "./types.js";

export type Boot = { catalog: Catalog; runs: Run[] };

export type PageData = {
  boot: Boot;
  hosts: Record<string, HostNote>;
  routes: Record<string, Route>;
  factors: Record<string, string>;
  /** "<language>:<target>" to the framework page for it, when this build wrote one. */
  pages: Record<string, string>;
};
