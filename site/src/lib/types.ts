// What a summary and an exemplar capture look like on disk.
//
// Parsed rather than asserted, because the files are written by harness/summarize.py and by
// the conformance client and arrive here as whatever a run of any age wrote. Every field the
// site reads is optional here and defaulted where it is used, so a summary from before a
// field existed loads and renders without it. `is_keyed` is the one shape check that rejects
// a file outright, and it lives in load.ts with its reason.
//
// Only what the site reads is declared. A summary carries plenty besides -- the machine
// block, the generator, the rung profile -- and declaring a field nothing renders would make
// the page refuse a run over a value it was never going to show. Unknown keys ride through
// untouched, because what is fetched at runtime is the whole document.
import { z } from "zod";

/** One rung's statistics: what a target did at one offered rate. */
export const Rung = z
  .object({
    achieved_rps: z.number().optional(),
    offered_rps: z.number().optional(),
    seconds: z.number().optional(),
    completed: z.boolean().optional(),
    saturated: z.boolean().optional(),
    dropped: z.number().optional(),
    errors: z.number().optional(),
    status_mismatch: z.number().optional(),
    p50_us: z.number().nullable().optional(),
    p90_us: z.number().nullable().optional(),
    p95_us: z.number().nullable().optional(),
    p99_us: z.number().nullable().optional(),
    p999_us: z.number().nullable().optional(),
  })
  .passthrough();
export type Rung = z.infer<typeof Rung>;

/** One endpoint's statistics at one rung. The keys are narrower than a rung's. */
export const EndpointRung = z
  .object({
    count: z.number().optional(),
    errors: z.number().optional(),
    mismatch: z.number().optional(),
    p50_us: z.number().nullable().optional(),
    p90_us: z.number().nullable().optional(),
    p95_us: z.number().nullable().optional(),
    p99_us: z.number().nullable().optional(),
    p999_us: z.number().nullable().optional(),
  })
  .passthrough();
export type EndpointRung = z.infer<typeof EndpointRung>;

export const EndpointRecord = z
  .object({
    family: z.string().optional(),
    rungs: z.record(z.string(), EndpointRung).optional(),
  })
  .passthrough();
export type EndpointRecord = z.infer<typeof EndpointRecord>;

export const FamilyRecord = z
  .object({
    count: z.number().optional(),
    p50_us: z.number().nullable().optional(),
    p90_us: z.number().nullable().optional(),
    p95_us: z.number().nullable().optional(),
    p99_us: z.number().nullable().optional(),
    p999_us: z.number().nullable().optional(),
  })
  .passthrough();
export type FamilyRecord = z.infer<typeof FamilyRecord>;

export const Target = z
  .object({
    language: z.string(),
    target: z.string(),
    framework: z.string().optional(),
    version: z.string().optional(),
    adapter: z.string().optional(),
    serializer: z.string().optional(),
    template: z.string().optional(),
    // What computed the validator on the etag rows, and what stored the response on the
    // cache rows. Both are the framework's own facility where it ships one, so the row is
    // read against the declaration the way a template row is read against its engine.
    etag: z.string().optional(),
    cache: z.string().optional(),
    target_runtime: z.string().optional(),
    bundle_hash: z.string().optional(),
    code_hash: z.string().optional(),
    exec_host: z.string().optional(),
    rungs: z.record(z.string(), Rung).default({}),
    families: z.record(z.string(), FamilyRecord).optional(),
    families_by_rung: z.record(z.string(), z.record(z.string(), FamilyRecord)).optional(),
    endpoints: z.record(z.string(), EndpointRecord).optional(),
  })
  .passthrough();
export type Target = z.infer<typeof Target>;

export const Run = z
  .object({
    run_id: z.string(),
    date: z.string().optional(),
    commit: z.string().optional(),
    repo: z.string().optional(),
    suite: z.string().optional(),
    epoch: z.union([z.number(), z.string()]).optional(),
    tracked: z.boolean().optional(),
    exec_host: z.string().optional(),
    cpu: z.string().optional(),
    cores: z.number().optional(),
    languages: z.array(z.string()).optional(),
    rungs: z.array(z.union([z.number(), z.string()])).default([]),
    endpoint_order: z.array(z.string()).optional(),
    targets: z.array(Target).default([]),
  })
  .passthrough();
export type Run = z.infer<typeof Run>;

/** One request/response pair, trimmed for display. */
export const WireEndpoint = z.object({
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
export type WireEndpoint = z.infer<typeof WireEndpoint>;

export type WireDoc = {
  framework: string;
  version: string;
  adapter: string;
  serializer: string;
  endpoints: Record<string, WireEndpoint>;
};

/** An exemplar file as the conformance client writes it. */
export const Capture = z
  .object({
    framework: z.string().optional(),
    version: z.string().optional(),
    adapter: z.string().optional(),
    serializer: z.string().optional(),
    endpoints: z
      .array(
        z
          .object({
            endpoint: z.string(),
            family: z.string().optional(),
            request: z
              .object({
                method: z.string(),
                path: z.string(),
                headers: z.array(z.tuple([z.string(), z.string()])),
                body: z.string().nullish(),
                body_bytes: z.number().optional(),
              })
              .passthrough(),
            response: z
              .object({
                status: z.number(),
                headers: z.array(z.tuple([z.string(), z.string()])),
                header_bytes: z.number(),
                body_bytes: z.number(),
                body: z.string(),
                framing: z.string().optional(),
                truncated: z.boolean().optional(),
              })
              .passthrough(),
          })
          .passthrough(),
      )
      .default([]),
  })
  .passthrough();
export type Capture = z.infer<typeof Capture>;

/** Method, route and base edge per endpoint id, from spec/endpoints.json. */
export type Route = { m: string; p: string; b?: string; v?: string };

/** What a host is, and what it should be compared against. */
export type HostNote = { note: string; compare_to: string };
