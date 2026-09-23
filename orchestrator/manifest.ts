// rb.json: what a framework declares about itself, and the checks that hold it to that.
//
// Language and name are never declared. They are the two path segments under frameworks/,
// which makes the directory the one source of a framework's identity. Everything a framework
// needs is inside that directory, because it is the build context, so no path here may leave it.
//
// Loading is pure: the tracked files, a reader and the corpus are passed in, so every check is
// tested without a repository. loadRepo() wires it to this one.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

import suite from "@rb/tests";
import type { Framework, Test } from "@rb/tests/kit";
import exceptions from "../frameworks/exceptions.ts";
import { frameworkDir, frameworkId, type FrameworkKey } from "./bundle.ts";
import { discover, tracked } from "./discover.ts";
import { HOSTS, isHostId } from "./hosts.ts";
import { NOTES_HEADING, notesOf } from "./notes.ts";

/** A command run on the machine with the language's toolchain. argv, never a shell string. */
const command = z.strictObject({
  argv: z.array(z.string().min(1)).min(1),
  /** Relative to the framework's directory, which is the default. */
  cwd: z.string().min(1).optional(),
  env: z.record(z.string(), z.string()).optional(),
});

const mechanism = z.union([
  z.strictObject({
    mechanism: z.string().min(1),
    dependency: z.string().min(1).optional(),
    mentions: z.string().min(1).optional(),
  }),
  z.strictObject({ builtin: z.string().min(1) }),
]);

export const rbJsonSchema = z.strictObject({
  /** Why anything below departs from the obvious. JSON has no comments. */
  comment: z.string().optional(),
  framework: z.string().min(1),
  /** An SPDX identifier. */
  licence: z.string().min(1),
  repo: z.url(),
  /** The registry page for the package that was resolved. */
  package: z.url(),
  docs: z.url().optional(),
  /** Tracked files that pin what the framework resolved. null states that it pins nothing. */
  lockfile: z.array(z.string().min(1)).min(1).nullable(),
  /** How the framework is built and started on each host it implements. */
  hosts: z
    .record(
      z.string(),
      z.strictObject({
        dockerfile: z.string().min(1),
        buildArgs: z.record(z.string(), z.string()).optional(),
      }),
    )
    .refine((hosts) => Object.keys(hosts).length > 0, "a framework implements at least one host"),
  /** The framework's own tests. `paths` are the directories holding them, which the bundle gives role test. */
  suite: z
    .strictObject({
      argv: z.array(z.string().min(1)).min(1),
      cwd: z.string().min(1).optional(),
      env: z.record(z.string(), z.string()).optional(),
      paths: z.array(z.string().min(1)).min(1),
    })
    .optional(),
  /** Moves the pins in place. null states that they move by hand. */
  upgrade: command.nullable(),
  /**
   * The OpenAPI document the framework writes about its own routes, and the client generated from
   * it, both under Client/. `argv` rewrites the two with the framework's own toolchain.
   */
  client: z
    .strictObject({
      ...command.shape,
      document: z.string().min(1),
      /** What writes the document, and when. */
      writer: z.string().min(1),
      /** What generates the client from it, and its version. */
      generator: z.string().min(1),
    })
    .optional(),
  /** Validation tests this framework does not satisfy, each with the reason. */
  skips: z.record(z.string(), z.string().min(1)).optional(),
  /** Performance tests the framework answers with no handler of its own, each with what answers them. */
  noHandler: z.record(z.string(), z.string().min(1)).optional(),
  /** Per family, the mechanism that wires it, or why there is nothing to show. */
  mechanisms: z.record(z.string(), mechanism),
});

export type RbJson = z.output<typeof rbJsonSchema>;

export interface LoadedFramework extends FrameworkKey {
  /** `dotnet:carter`. */
  readonly id: string;
  /** `frameworks/dotnet/carter`. */
  readonly dir: string;
  readonly rb: RbJson;
  /** What a validation test's `scope` reads. */
  readonly declared: Framework;
}

export interface LoadInput {
  /** `frameworks/<language>/<name>/rb.json`, as discovery found them. */
  readonly manifests: readonly string[];
  readonly tracked: ReadonlySet<string>;
  readonly read: (path: string) => string;
  /** The frameworks frameworks/exceptions.ts declares an error envelope for. */
  readonly registry: readonly string[];
  readonly tests: Readonly<Record<string, Pick<Test, "kind">>>;
  readonly families: readonly string[];
}

export interface Loaded {
  readonly frameworks: LoadedFramework[];
  readonly problems: string[];
}

const keyOf = (manifest: string): FrameworkKey => {
  const [, language, name] = manifest.split("/");
  return { language: language!, name: name! };
};

/** A path a framework names, which must stay inside its directory, because nothing outside reaches its image. */
function within(dir: string, rel: string): string | undefined {
  const parts = rel.replace(/\/+$/, "").split("/");
  if (rel.startsWith("/") || parts.some((p) => p === "..")) return undefined;
  return [dir, ...parts.filter((p) => p !== "" && p !== ".")].join("/");
}

const trackedUnder = (tracked: ReadonlySet<string>, path: string): boolean => {
  if (tracked.has(path)) return true;
  for (const t of tracked) if (t.startsWith(`${path}/`)) return true;
  return false;
};

function check(f: FrameworkKey & { dir: string; id: string }, rb: RbJson, input: LoadInput): string[] {
  const out: string[] = [];
  const at = `${f.dir}/rb.json`;
  const path = (what: string, rel: string, file: boolean) => {
    const full = within(f.dir, rel);
    if (full === undefined) out.push(`${at}: ${what} ${rel} leaves the framework's directory`);
    else if (file ? !input.tracked.has(full) : !trackedUnder(input.tracked, full)) out.push(`${at}: ${what} ${rel} is not tracked`);
  };

  const readme = `${f.dir}/README.md`;
  if (!input.tracked.has(readme)) out.push(`${at}: there is no README.md beside it`);
  else {
    const notes = notesOf(input.read(readme));
    if (notes === null) out.push(`${readme}: there is no ${NOTES_HEADING} section`);
    else if (notes.items.length === 0) out.push(`${readme}: ${NOTES_HEADING} lists nothing`);
    for (const line of notes?.stray ?? []) out.push(`${readme}:${line}: a line under ${NOTES_HEADING} that is not part of its list`);
  }
  for (const lock of rb.lockfile ?? []) path("lockfile", lock, true);
  for (const [host, entry] of Object.entries(rb.hosts)) {
    if (!isHostId(host)) out.push(`${at}: hosts.${host} is not a host, only ${Object.keys(HOSTS).join(", ")} are`);
    path(`hosts.${host}.dockerfile`, entry.dockerfile, true);
  }
  if (rb.suite !== undefined) {
    for (const p of rb.suite.paths) path("suite.paths", p, false);
    if (rb.suite.cwd !== undefined) path("suite.cwd", rb.suite.cwd, false);
  }
  if (rb.upgrade?.cwd !== undefined) path("upgrade.cwd", rb.upgrade.cwd, false);
  if (rb.client !== undefined) {
    path("client.document", rb.client.document, true);
    if (!rb.client.document.startsWith("Client/")) out.push(`${at}: client.document ${rb.client.document} is not under Client/`);
    if (rb.client.cwd !== undefined) path("client.cwd", rb.client.cwd, false);
  }

  for (const [id, why] of Object.entries(rb.skips ?? {})) {
    const test = input.tests[id];
    if (test === undefined) out.push(`${at}: skips.${id} names no test`);
    else if (test.kind === "performance") out.push(`${at}: skips.${id} is a performance test, which every framework answers (${why})`);
  }
  for (const id of Object.keys(rb.noHandler ?? {})) {
    const test = input.tests[id];
    if (test === undefined) out.push(`${at}: noHandler.${id} names no test`);
    else if (test.kind !== "performance") out.push(`${at}: noHandler.${id} is a validation test, which no framework has to locate a handler for`);
  }

  const families = new Set(input.families);
  for (const family of Object.keys(rb.mechanisms)) {
    if (!families.has(family)) out.push(`${at}: mechanisms.${family} names no family`);
  }
  const undeclared = input.families.filter((family) => !Object.hasOwn(rb.mechanisms, family));
  if (undeclared.length > 0) out.push(`${at}: mechanisms has no entry for ${undeclared.join(", ")}`);
  return out;
}

export function loadFrameworks(input: LoadInput): Loaded {
  const frameworks: LoadedFramework[] = [];
  const problems: string[] = [];
  for (const manifest of [...input.manifests].sort()) {
    const key = keyOf(manifest);
    const f = { ...key, id: frameworkId(key), dir: frameworkDir(key) };
    let raw: unknown;
    try {
      raw = JSON.parse(input.read(manifest));
    } catch (error) {
      problems.push(`${manifest}: not JSON (${(error as Error).message})`);
      continue;
    }
    const parsed = rbJsonSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) problems.push(`${manifest}: ${issue.path.join(".") || "the manifest"}: ${issue.message}`);
      continue;
    }
    const rb = parsed.data;
    const found = check(f, rb, input);
    problems.push(...found);
    if (found.length > 0) continue;
    frameworks.push({
      ...f,
      rb,
      declared: { language: f.language, name: f.name, framework: rb.framework, hosts: rb.hosts, mechanisms: rb.mechanisms },
    });
  }

  // Discovery finds frameworks and the registry types their error envelopes, so they are two
  // lists, and this keeps every framework in both. A declaration may come before its
  // framework: the corpus tests read fastify's and fastapi's without either being built.
  for (const manifest of input.manifests) {
    const id = frameworkId(keyOf(manifest));
    if (!input.registry.includes(id)) problems.push(`${id} has an rb.json and no entry in frameworks/exceptions.ts`);
  }
  return { frameworks, problems };
}

/** Every framework in this repository, as its working tree declares it. */
export function loadRepo(root: string): Loaded {
  return loadFrameworks({
    manifests: discover(root).frameworks,
    tracked: new Set(tracked(root)),
    read: (path) => readFileSync(join(root, path), "utf8"),
    registry: Object.keys(exceptions),
    tests: suite.tests,
    families: Object.keys(suite.families),
  });
}
