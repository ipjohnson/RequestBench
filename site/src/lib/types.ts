// What a summary and an exemplar file look like on disk.
//
// Parsed rather than asserted, because the files are written by `rb summarize` and by
// `rb validate --exemplars` and arrive here as whatever a run of any age wrote. Every field the
// site reads is optional here and defaulted where it is used, so a summary from before a field
// existed loads and renders without it.
//
// Only what the site reads is declared. A summary carries plenty besides, such as the machine
// block, the generator and the budget, and declaring a field nothing renders would make the
// page refuse a run over a value it was never going to show. Unknown keys ride through
// untouched, because what is fetched at runtime is the whole document.
import { z } from "zod";

/**
 * One rung's statistics: what a framework did at one offered rate. A closed loop's one rung has
 * no offered rate, and its achievedRps is the invocations a second the function sustained.
 */
export const Rung = z.looseObject({
  rps: z.number().optional(),
  closed: z.boolean().optional(),
  invocations: z.number().optional(),
  /** A closed loop's first recorded invocation, which with no warmup is the function's first. */
  first: z.looseObject({ id: z.string(), responseUs: z.number() }).optional(),
  status: z.string().optional(),
  completed: z.boolean().optional(),
  saturated: z.boolean().optional(),
  achievedRps: z.number().optional(),
  dropped: z.number().optional(),
  errors: z.number().optional(),
  mismatch: z.number().optional(),
  p50Us: z.number().nullable().optional(),
  p90Us: z.number().nullable().optional(),
  p99Us: z.number().nullable().optional(),
});
export type Rung = z.infer<typeof Rung>;

/** The grid a summary counted its `bins` on. Recorded by the summary so the axis is
 *  labelled from the data being drawn rather than from a constant agreed out of band. */
export const BinGrid = z.object({
  loUs: z.number(),
  perDecade: z.number(),
  count: z.number(),
});
export type BinGrid = z.infer<typeof BinGrid>;

/** The generator's grid, which `hist` is counted on: bucket i starts at growth^i µs. */
export const HistGrid = z.object({
  growth: z.number(),
  count: z.number(),
});
export type HistGrid = z.infer<typeof HistGrid>;

/**
 * How the summary cut each test's recording into windows, and what each place of a window holds:
 * a window is a tuple, and `fields` names its places.
 */
export const WindowGrid = z.object({
  seconds: z.number(),
  fields: z.array(z.string()),
});
export type WindowGrid = z.infer<typeof WindowGrid>;

/** A histogram on the summary's `histGrid` with its empty ends cut off: `counts[0]` is bucket `first`. */
export const Hist = z.object({
  first: z.number(),
  counts: z.array(z.number()),
});
export type Hist = z.infer<typeof Hist>;

/** One test's statistics at one rung. The keys are narrower than a rung's. */
export const TestRung = z.looseObject({
  count: z.number().optional(),
  errors: z.number().optional(),
  mismatch: z.number().optional(),
  p50Us: z.number().nullable().optional(),
  p90Us: z.number().nullable().optional(),
  p99Us: z.number().nullable().optional(),
  /** The test's latency histogram on the summary's `binGrid`, counts per bin. */
  bins: z.array(z.number()).optional(),
  /** The same on `histGrid`, fine enough to read a blend's percentiles from. */
  hist: Hist.optional(),
  /** Each window of the recording, in order, laid out as the summary's `windowGrid` says. */
  windows: z.array(z.array(z.number())).optional(),
});
export type TestRung = z.infer<typeof TestRung>;

export const TestRecord = z.looseObject({
  family: z.string().optional(),
  rungs: z.record(z.string(), TestRung).optional(),
});
export type TestRecord = z.infer<typeof TestRecord>;

export const FamilyRecord = z.looseObject({
  count: z.number().optional(),
  p50Us: z.number().nullable().optional(),
  p90Us: z.number().nullable().optional(),
  p99Us: z.number().nullable().optional(),
});
export type FamilyRecord = z.infer<typeof FamilyRecord>;

/** One framework in a run, as `rb summarize` writes it. */
export const Framework = z.looseObject({
  /** `dotnet:carter`. */
  id: z.string(),
  language: z.string(),
  name: z.string(),
  ordinal: z.number().optional(),
  framework: z.string().optional(),
  version: z.string().optional(),
  runtime: z.string().optional(),
  /** What /__meta answered, verbatim. */
  meta: z.record(z.string(), z.unknown()).optional(),
  bundleHash: z.string().optional(),
  codeHash: z.string().optional(),
  gate: z.looseObject({ measurable: z.boolean(), passed: z.boolean() }).optional(),
  /** The measured boot. On lambda-emulator readyMs is the function's Init. */
  boot: z.looseObject({ readyMs: z.number().optional() }).optional(),
  /** The tests it cannot answer on the run's host, each with the reason. Neither the gate nor the load sent them. */
  unsupported: z.record(z.string(), z.string()).optional(),
  /** Why this framework has no measurement. */
  error: z.string().optional(),
  rungs: z.record(z.string(), Rung).default({}),
  /** By test id. */
  tests: z.record(z.string(), TestRecord).default({}),
  /** By rung, then by family. */
  families: z.record(z.string(), z.record(z.string(), FamilyRecord)).default({}),
});
export type Framework = z.infer<typeof Framework>;

export const Run = z.looseObject({
  runId: z.string(),
  date: z.string().optional(),
  host: z.string().optional(),
  /** Whether the run enters the published series. `notRecorded` says why not. */
  recorded: z.boolean().optional(),
  notRecorded: z.array(z.string()).optional(),
  commit: z.string().optional(),
  repo: z.string().optional(),
  ladder: z.string().optional(),
  corpusVersion: z.string().optional(),
  /** The tests bundle's hashes, which the page's test sources are verified against. */
  tests: z.looseObject({ bundleHash: z.string().optional(), codeHash: z.string().optional() }).optional(),
  machine: z.looseObject({ cpu: z.string().optional(), cores: z.number().optional() }).optional(),
  binGrid: BinGrid.optional(),
  histGrid: HistGrid.optional(),
  windowGrid: WindowGrid.optional(),
  frameworks: z.array(Framework).default([]),
});
export type Run = z.infer<typeof Run>;

/** One request/response pair, trimmed for display. */
export const WireExchange = z.object({
  family: z.string(),
  m: z.string(),
  p: z.string(),
  rh: z.array(z.tuple([z.string(), z.string()])),
  rb: z.string(),
  rbz: z.number(),
  s: z.number(),
  sh: z.array(z.tuple([z.string(), z.string()])),
  shz: z.number(),
  sbz: z.number(),
  fr: z.string(),
  sb: z.string(),
  tr: z.boolean(),
});
export type WireExchange = z.infer<typeof WireExchange>;

export type WireDoc = {
  /** `dotnet:carter`. */
  framework: string;
  host: string;
  /** By test id. */
  tests: Record<string, WireExchange>;
};

const Header = z.tuple([z.string(), z.string()]);

/** An exemplar file as `rb validate --exemplars` writes it: one exchange per test. */
export const Exemplars = z.looseObject({
  framework: z.string().default(""),
  host: z.string().default(""),
  tests: z
    .record(
      z.string(),
      z.looseObject({
        request: z.looseObject({
          method: z.string(),
          target: z.string(),
          headers: z.array(Header),
          bodyBytes: z.number().default(0),
          body: z.string().optional(),
        }),
        response: z.looseObject({
          status: z.number(),
          headers: z.array(Header),
          headerBytes: z.number(),
          framing: z.string().default(""),
          bodyBytes: z.number(),
          body: z.string(),
          truncated: z.boolean().default(false),
        }),
      }),
    )
    .default({}),
});
export type Exemplars = z.infer<typeof Exemplars>;

/** Method, route and base edge per test id, from the corpus. */
export type Route = { m: string; p: string; b?: string; v?: string };

/** What a host is, from orchestrator/hosts.ts. */
export type HostNote = { note: string };
