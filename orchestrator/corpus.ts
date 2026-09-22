// The corpus as the orchestrator reads it: every test recorded once, the endpoints the snippet
// matcher looks for, and the version a run files itself under.
//
// The version is what makes two runs comparable. It hashes what each performance test sends
// and asserts, taken from its recording rather than from its source, so correcting an `about`
// leaves it alone while a changed path, header, assertion or payload moves it. It also hashes
// the payload files every framework loads and the shape of the values drawn per run, which
// decide how many bytes go out. Validation tests stay out, which is what makes adding one free.
import { createHash } from "node:crypto";
import { z } from "zod";

import suite from "@rb/tests";
import type { Payload, Suite } from "@rb/tests/kit";
import { runValuesSchema } from "@rb/tests/models/parameters";
import { blob, tracked } from "./git.ts";
import { recorder, type RecordedCall, type Recording } from "./record.ts";

/** One endpoint as the snippet matcher looks for it. */
export interface Endpoint {
  readonly id: string;
  readonly family: string;
  readonly method: string;
  /** The declared path, with `{...}` where a value is drawn. */
  readonly path: string;
  /** The test this one is read against, when it has one. */
  readonly base?: string | undefined;
}

/** Every test's recording, by id. Recording sends nothing, so this is cheap and exact. */
export async function recordAll(s: Suite = suite): Promise<Map<string, Recording>> {
  const out = new Map<string, Recording>();
  for (const id of Object.keys(s.tests).sort()) {
    const { client, recording } = recorder();
    await s.tests[id]!.request(client);
    out.set(id, recording);
  }
  return out;
}

/** The call a test is about. A priming call made inside `once` is a means, not the subject. */
export const subjectOf = (r: Recording): RecordedCall | undefined => r.calls.filter((c) => !c.priming).at(-1);

/**
 * Every test with a path, as the snippet matcher needs it. The method is the one its subject
 * call sends, because a test declares its path and leaves the method inside its closure.
 */
export function endpoints(s: Suite, recordings: ReadonlyMap<string, Recording>): Endpoint[] {
  const out: Endpoint[] = [];
  for (const [id, recording] of recordings) {
    const test = s.tests[id]!;
    const call = subjectOf(recording);
    if (test.path === undefined || call === undefined) continue;
    const base = test.kind === "performance" ? test.base : undefined;
    out.push({ id, family: test.id.family, method: call.method, path: test.path, ...(base === undefined ? {} : { base }) });
  }
  return out;
}

export const isPayload = (v: object): v is Payload =>
  typeof (v as Payload).name === "string" && ["json", "lines", "events", "text", "html"].includes((v as Payload).format) && "value" in v;

/**
 * JSON with keys sorted, so reordering an object literal does not move the version. A payload is
 * its name, format, value and what it is made from; its model is the shape the value was
 * already checked against, and a zod schema has no stable serialisation.
 */
function canonical(v: unknown): unknown {
  if (v === null || typeof v !== "object") {
    if (typeof v === "function" || typeof v === "symbol") throw new Error(`a recording holds a ${typeof v}`);
    return v;
  }
  if (v instanceof RegExp) return { regexp: v.source, flags: v.flags };
  if (Array.isArray(v)) return v.map(canonical);
  if (isPayload(v)) {
    return { payload: v.name, format: v.format, value: canonical(v.value), from: (v.from ?? []).map((p) => p.name) };
  }
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(v).sort()) {
    const x = (v as Record<string, unknown>)[key];
    if (x !== undefined) out[key] = canonical(x);
  }
  return out;
}

const sha256 = (bytes: Buffer | string): string => createHash("sha256").update(bytes).digest("hex");

/** The payload files every framework loads, from the working tree, with their hashes. */
export function payloadFiles(root: string): { path: string; hash: string }[] {
  return tracked(root, "tests/payloads/")
    .filter((path) => !path.endsWith(".ts"))
    .map((path) => ({ path, hash: sha256(blob(root, path)) }));
}

export function corpusVersion(
  s: Suite,
  recordings: ReadonlyMap<string, Recording>,
  payloads: readonly { path: string; hash: string }[],
): string {
  const tests = [...recordings.keys()]
    .sort()
    .filter((id) => s.tests[id]!.kind === "performance")
    .map((id) => ({ id, path: s.tests[id]!.path, recording: canonical(recordings.get(id)) }));
  const doc = {
    tests,
    payloads: [...payloads].sort((a, b) => (a.path < b.path ? -1 : 1)),
    runValues: canonical(z.toJSONSchema(runValuesSchema)),
  };
  return `sha256:${sha256(JSON.stringify(doc))}`;
}
