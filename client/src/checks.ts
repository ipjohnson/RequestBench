// What a response has to carry regardless of framework, and the bytes to compare.
//
// Ported from harness/conform.py. Latency says nothing about any of this, and frameworks
// differ more here than anywhere else.
import { gunzipSync } from "node:zlib";

/** A response header as it arrived, before any case folding. Duplicates are kept. */
export type Header = readonly [name: string, value: string];

type Rule = { readonly name: string; readonly why: string };

const ALWAYS: readonly Rule[] = [
  { name: "content-type", why: "every response must declare its type" },
  { name: "content-length", why: "every response must declare its length" },
];
const FOR_STATUS: Readonly<Record<number, readonly Rule[]>> = {
  201: [{ name: "location", why: "a 201 must say where the thing was created" }],
};
const NO_BODY = new Set([204, 304]);

/** Families whose responses carry x-rb-serial. */
export const FRESH_PREFIXES = ["compressed.", "cached."] as const;

export const isFreshnessChecked = (endpointId: string): boolean =>
  FRESH_PREFIXES.some((p) => endpointId.startsWith(p));

/** Last value wins on a duplicate, matching the Python dict comprehension. */
function folded(headers: readonly Header[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of headers) out.set(k.toLowerCase(), v);
  return out;
}

/** Approximate wire cost: name, colon-space, value, CRLF per header. */
export const headerBytes = (headers: readonly Header[]): number =>
  headers.reduce((n, [k, v]) => n + k.length + v.length + 4, 0);

export function framing(headers: readonly Header[]): "content-length" | "chunked" | "none" {
  const got = folded(headers);
  if (got.has("content-length")) return "content-length";
  if ((got.get("transfer-encoding") ?? "").includes("chunked")) return "chunked";
  return "none";
}

export type Encoding = "http" | "lambda";

export function checkHeaders(
  status: number, headers: readonly Header[], body: Buffer, encoding: Encoding = "http",
): string[] {
  const got = folded(headers);
  const problems: string[] = [];
  for (const { name, why } of [...ALWAYS, ...(FOR_STATUS[status] ?? [])]) {
    if (NO_BODY.has(status) && (name === "content-length" || name === "content-type")) continue;
    // Chunked framing declares the length differently; both are valid, and which one a
    // framework picks is worth recording rather than failing.
    if (name === "content-length" && framing(headers) === "chunked") continue;
    // A Lambda handler returns a JSON envelope, not an HTTP response. API Gateway sets the
    // length downstream, so demanding the function declare it tests the wrong layer.
    if (name === "content-length" && encoding === "lambda") continue;
    if (!got.has(name)) problems.push(`missing ${name} (${why})`);
  }
  const cl = got.get("content-length");
  if (cl !== undefined && /^\d+$/.test(cl) && Number(cl) !== body.length) {
    problems.push(`content-length ${cl} but body is ${body.length} bytes`);
  }
  const ctype = got.get("content-type");
  if (ctype !== undefined && body.length > 0) {
    const first = String.fromCharCode(body[leadingNonSpace(body)] ?? 0);
    if ((first === "{" || first === "[") && !ctype.includes("json")) {
      problems.push(`JSON body served as ${ctype}`);
    }
  }
  return problems;
}

/** Index of the first byte that is not ASCII whitespace, as Python's lstrip() finds it. */
function leadingNonSpace(body: Buffer): number {
  const ws = new Set([0x20, 0x09, 0x0a, 0x0d, 0x0c, 0x0b]);
  let i = 0;
  while (i < body.length && ws.has(body[i] as number)) i++;
  return i;
}

/**
 * The bytes to compare, which are not always the bytes on the wire.
 *
 * gzip output differs between zlib, Java's Deflater and Go's compress/flate at the same
 * level. The decompressed bytes must not, so the comparison is taken over those. The wire
 * bytes are still what the content-length contract is checked against.
 */
export function decoded(raw: Buffer, headers: readonly Header[]): Buffer {
  const enc = folded(headers).get("content-encoding") ?? "";
  if (raw.length > 0 && enc.includes("gzip")) {
    try {
      return gunzipSync(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

/**
 * What kind of body this is, which is part of the contract rather than incidental.
 *
 * A target answering the right values as text/plain is not answering correctly.
 */
export function bodyClass(contentType: string | undefined): string {
  const ctype = (contentType ?? "").toLowerCase();
  if (ctype.includes("json")) return "json";
  if (ctype.includes("html")) return "html";
  if (ctype.includes("text")) return "text";
  return ctype === "" ? "none" : "other";
}

/** Whether the body arrived compressed, which the decoded bytes no longer say. */
export const contentEncoding = (headers: readonly Header[]): string =>
  folded(headers).get("content-encoding") ?? "";

export function serialOf(headers: readonly Header[], previous: number | null): number | null {
  const v = folded(headers).get("x-rb-serial");
  return v !== undefined && /^\d+$/.test(v) ? Number(v) : previous;
}

/**
 * Why x-rb-serial is unacceptable on this response, or null.
 *
 * A target that served a response from a cache anywhere in its own path, or precomputed it
 * at boot, repeats a counter it did not increment. Identical bytes are the whole point of
 * the comparison, so this is the only thing that can tell the two apart.
 */
export function advanced(headers: readonly Header[], previous: number | null): string | null {
  const v = folded(headers).get("x-rb-serial");
  if (v === undefined) return "no x-rb-serial (the response must prove the handler ran)";
  if (!/^\d+$/.test(v)) return `x-rb-serial ${JSON.stringify(v)} is not a number`;
  if (previous !== null && Number(v) <= previous) {
    return `x-rb-serial did not advance (${v} after ${previous})`;
  }
  return null;
}
